/* eslint-disable */
import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

import { EmbeddingService } from '../embedding/embedding.service';
import { QdrantService } from '../qdrant/qdrant.service';
import { DatabaseService } from '../database/database.service';

import { CollectionType, Gender } from '../qdrant/dto/qdrant.dto';

import {
  QdrantInsertResponse,
  QdrantSearchResponse,
} from '../qdrant/models/qdrant.model';

import { EmbedResponseDto } from '../embedding/dto/embeded-response.dto';

import {
  SearchDto,
  EmbeddingQdrantBatchResult,
} from './dto/embedding-qdrant.dto';

import { ProductItemTransferDto } from '../product-item/dto/product-item.dto';

@Injectable()
export class EmbeddingQdrantService {
  private readonly logger = new Logger(EmbeddingQdrantService.name);

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly qdrantService: QdrantService,
    private readonly db: DatabaseService,
  ) {}

  /* ───────────────────────────── search helpers ───────────────────────────── */

  async searchByText(
    query: string,
    filters: SearchDto,
  ): Promise<ProductItemTransferDto[]> {
    const queryEmbedding =
      await this.embeddingService.generateTextEmbedding(query);

    const searchRes: QdrantSearchResponse = await this.qdrantService.search({
      collection: CollectionType.TEXT_EMBEDDINGS,
      vector: queryEmbedding,
      ...filters,
    });
    if (!searchRes.results.length) {
      throw new HttpException(
        'No products matched your search',
        HttpStatus.NOT_FOUND,
      );
    }

    const products = await this.db.productItem.findMany({
      where: { id: { in: searchRes.results.map((r) => r.id) } },
      select: {
        id: true,
        name: true,
        brand: true,
        category: true,
        price: true,
        retailer: true,
        url: true,
        productStyles: { select: { style: { select: { name: true } } } },
        productImages: {
          select: { id: true, imageUrl: true, frontFacing: true },
          orderBy: { id: 'asc' },
        },
      },
    });

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      price: p.price,
      retailer: p.retailer,
      url: p.url,
      style: p.productStyles.map((s) => s.style.name),
      images: p.productImages,
    }));
  }

  async searchByImage(
    file: Express.Multer.File,
    filters: SearchDto,
  ): Promise<ProductItemTransferDto[]> {
    if (!file)
      throw new HttpException('No image supplied', HttpStatus.BAD_REQUEST);

    const { label, embedding } =
      await this.embeddingService.generateImageEmbedding(file);
    const collection =
      label === 'front'
        ? CollectionType.IMAGE_FRONT_EMBEDDINGS
        : CollectionType.IMAGE_BACK_EMBEDDINGS;

    const searchRes = await this.qdrantService.search({
      collection,
      vector: embedding,
      ...filters,
    });
    if (!searchRes.results.length) {
      throw new HttpException(
        'No products matched your image',
        HttpStatus.NOT_FOUND,
      );
    }

    const products = await this.db.productItem.findMany({
      where: { id: { in: searchRes.results.map((r) => r.id) } },
      select: {
        id: true,
        name: true,
        brand: true,
        category: true,
        price: true,
        retailer: true,
        url: true,
        productStyles: { select: { style: { select: { name: true } } } },
        productImages: {
          select: { id: true, imageUrl: true, frontFacing: true },
          orderBy: { id: 'asc' },
        },
      },
    });

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      price: p.price,
      retailer: p.retailer,
      url: p.url,
      style: p.productStyles.map((s) => s.style.name),
      images: p.productImages,
    }));
  }

  /* ─────────────────────── batch pipeline (optimised) ─────────────────────── */

  async generateAndStoreEmbeddingsForRetailer(
    retailer: string,
    dbBatchSize = 32,
    concurrency = 32, // kept for API, no longer used (bulk writes)
  ): Promise<EmbeddingQdrantBatchResult> {
    const start = Date.now();
    this.logger.log(`🚀  embedding <${retailer}>  – batchSize=${dbBatchSize}`);

    let processed = 0,
      inserted = 0,
      failed = 0;
    const errors: Array<{ productId: number; error: string; type: string }> =
      [];
    const summaries: {
      productId: number;
      hasF: boolean;
      hasB: boolean;
      hasT: boolean;
    }[] = [];

    while (true) {
      const t0 = Date.now();

      // 1. Fetch DB rows
      const rows = await this.db.productItem.findMany({
        where: { retailer, embedding: null },
        select: {
          id: true,
          metaData: true,
          productImages: {
            select: { id: true, imageUrl: true },
            orderBy: { id: 'asc' },
          },
        },
        orderBy: { id: 'asc' },
        take: dbBatchSize,
      });
      if (!rows.length) break;
      const t1 = Date.now();

      this.logger.log(`📦 Fetched ${rows.length} products from DB`);

      // 2. Call ML service
      let embeds: EmbedResponseDto[] = [];
      try {
        const mlStart = Date.now();
        const { data } = await axios.post(
          `${process.env.ML_URL}/api/v1/embedding/products-embed-batch`,
          {
            products: rows.map((r) => ({
              id: r.id,
              metaData: r.metaData,
              imageUrls: r.productImages.map((i) => i.imageUrl),
            })),
          },
          { timeout: 120_000 },
        );
        embeds = data.results;
        const mlEnd = Date.now();
        this.logger.log(
          `⏱️ ML batch: ${(mlEnd - mlStart) / 1000}s for ${rows.length} products`,
        );
      } catch (err: any) {
        failed += rows.length;
        rows.forEach((r) =>
          errors.push({ productId: r.id, error: err.message, type: 'ml' }),
        );
        continue;
      }
      const t2 = Date.now();

      this.logger.log(
        `🤖 ML returned ${embeds.length} embeddings for ${rows.length} products`,
      );

      // Log which products got embeddings
      embeds.forEach((e) => {
        const hasAny = e.frontEmbedding || e.backEmbedding || e.textEmbedding;
        this.logger.log(
          `Product ${e.productId}: ${hasAny ? 'HAS' : 'NO'} embeddings`,
        );
      });

      // 3. Qdrant upsert
      const qdrantStart = Date.now();
      const byCollection = new Map<CollectionType, any[]>();
      embeds.forEach((e) => {
        if (e.frontEmbedding) {
          this.pushVector(byCollection, CollectionType.IMAGE_FRONT_EMBEDDINGS, {
            id: e.productId,
            vector: e.frontEmbedding,
          });
        }
        if (e.backEmbedding) {
          this.pushVector(byCollection, CollectionType.IMAGE_BACK_EMBEDDINGS, {
            id: e.productId,
            vector: e.backEmbedding,
          });
        }
        if (e.textEmbedding) {
          this.pushVector(byCollection, CollectionType.TEXT_EMBEDDINGS, {
            id: e.productId,
            vector: e.textEmbedding,
          });
        }
      });
      await Promise.all(
        [...byCollection.entries()].map(async ([collection, pts]) => {
          try {
            await this.qdrantService.upsertPointsBulk(collection, pts);
          } catch (err: any) {
            failed += pts.length;
            pts.forEach((p) =>
              errors.push({
                productId: p.id,
                error: err.message,
                type: collection,
              }),
            );
          }
        }),
      );
      const qdrantEnd = Date.now();
      this.logger.log(`⏱️ Qdrant upsert: ${(qdrantEnd - qdrantStart) / 1000}s`);

      // 4. DB update
      const dbStart = Date.now();
      const updateOps = [];

      for (const e of embeds) {
        // Update embedding field
        const embeddingValue =
          e.frontEmbedding || e.backEmbedding || e.textEmbedding
            ? this.embeddingService.determineEmbeddingConfig(e)
            : 'skip';

        updateOps.push(
          this.db.productItem.update({
            where: { id: e.productId },
            data: {
              embedding: embeddingValue,
            },
          }),
        );

        // Update frontFacing flags if present
        if (e.frontFacingImages?.length) {
          const row = rows.find((r) => r.id === e.productId);
          if (row) {
            for (let idx = 0; idx < row.productImages.length; idx++) {
              updateOps.push(
                this.db.productImage.update({
                  where: { id: row.productImages[idx].id },
                  data: { frontFacing: e.frontFacingImages[idx] ?? false },
                }),
              );
            }
          }
        }
      }

      await this.db.$transaction(updateOps);
      const dbEnd = Date.now();
      this.logger.log(`⏱️ DB update: ${(dbEnd - dbStart) / 1000}s`);

      this.logger.log(
        `⏱️ Batch total: ${(Date.now() - t0) / 1000}s (DB fetch: ${(t1 - t0) / 1000}s, ML: ${(t2 - t1) / 1000}s, Qdrant: ${(qdrantEnd - qdrantStart) / 1000}s, DB update: ${(dbEnd - dbStart) / 1000}s)`,
      );
    }

    const ms = Date.now() - start;
    this.logger.log(
      `🏁 ${retailer} finished: ${processed}/${inserted} ok, ${failed} failed in ${Math.round(ms / 1000)} s`,
    );

    return {
      embeddingResults: summaries,
      qdrantResults: {
        totalProcessed: processed,
        totalSuccessful: inserted,
        totalFailed: failed,
        errors,
      },
      timeElapsed: ms,
    };
  }

  async processProductEmbedding(productId: number): Promise<{
    frontEmbedding?: number[];
    backEmbedding?: number[];
    textEmbedding?: number[];
  }> {
    const overallStart = Date.now();

    /* 1. pull product + images */
    const dbFetchStart = Date.now();
    const product = await this.db.productItem.findUnique({
      where: { id: productId },
      select: {
        id: true,
        metaData: true,
        productImages: {
          select: { imageUrl: true },
          orderBy: { id: 'asc' },
        },
      },
    });
    const dbFetchEnd = Date.now();

    if (!product) {
      throw new HttpException(
        `Product ${productId} not found`,
        HttpStatus.NOT_FOUND,
      );
    }
    if (!product.productImages.length) {
      throw new HttpException(
        `Product ${productId} has no images`,
        HttpStatus.BAD_REQUEST,
      );
    }

    /* 2. ML embed call */
    const mlStart = Date.now();
    const embedResp = await this.embeddingService.embedProduct(product);
    const mlEnd = Date.now();

    /* 3. write vectors → Qdrant & update DB */
    const qdrantStart = Date.now();
    await this.addProductEmbedding(embedResp);
    const qdrantEnd = Date.now();

    const overallEnd = Date.now();

    // Log detailed timing
    this.logger.log(
      `⏱️ Product ${productId} timing breakdown:` +
        ` DB fetch: ${dbFetchEnd - dbFetchStart}ms` +
        ` | ML: ${mlEnd - mlStart}ms` +
        ` | Qdrant+DB: ${qdrantEnd - qdrantStart}ms` +
        ` | TOTAL: ${overallEnd - overallStart}ms`,
    );

    return {
      frontEmbedding: embedResp.frontEmbedding ?? undefined,
      backEmbedding: embedResp.backEmbedding ?? undefined,
      textEmbedding: embedResp.textEmbedding ?? undefined,
    };
  }

  /* ───────────── smaller helpers, unchanged except tiny refactor ─────────── */

  private pushVector(
    byCollection: Map<CollectionType, any[]>,
    collection: CollectionType,
    vector: any,
  ) {
    if (!byCollection.has(collection)) byCollection.set(collection, []);
    byCollection.get(collection)!.push(vector);
  }

  private async addProductEmbedding(
    e: EmbedResponseDto,
  ): Promise<QdrantInsertResponse> {
    const {
      productId,
      frontEmbedding,
      backEmbedding,
      textEmbedding,
      frontFacingImages,
    } = e;

    /* fetch metadata once */
    const product = await this.db.productItem.findUnique({
      where: { id: productId },
      select: {
        price: true,
        brand: true,
        category: true,
        sex: true,
        retailer: true,
        productStyles: { select: { style: { select: { name: true } } } },
      },
    });

    if (!product) {
      throw new HttpException(
        `Product ${productId} metadata missing`,
        HttpStatus.NOT_FOUND,
      );
    }

    const metadata = {
      style: product.productStyles.map((s) => s.style.name),
      price: product.price,
      category: [product.category].filter((c): c is string => c !== null),
      gender: [product.sex as Gender],
      brand: [product.brand],
      retailer: [product.retailer],
    };

    /* update DB record + images */
    await this.updateProduct(
      productId,
      frontFacingImages,
      this.embeddingService.determineEmbeddingConfig(e),
    );

    if (frontEmbedding) {
      this.qdrantService.insertVector({
        collection: CollectionType.IMAGE_FRONT_EMBEDDINGS,
        productId,
        vector: frontEmbedding,
        ...metadata,
      });
    }
    if (backEmbedding) {
      this.qdrantService.insertVector({
        collection: CollectionType.IMAGE_BACK_EMBEDDINGS,
        productId,
        vector: backEmbedding,
        ...metadata,
      });
    }
    if (textEmbedding) {
      this.qdrantService.insertVector({
        collection: CollectionType.TEXT_EMBEDDINGS,
        productId,
        vector: textEmbedding,
        ...metadata,
      });
    }

    return { status: 'success' };
  }

  /**
   * Update `ProductItem.embedding` and every image’s `frontFacing` flag.
   * Expects `frontFacingFlags` to be an array of booleans (one per image) indicating if the image is front facing.
   */
  private async updateProduct(
    productId: number,
    frontFacingFlags: boolean[],
    embeddingConfig: string | null,
  ): Promise<void> {
    // Pull images (ordered ascending by id)
    const imgs = await this.db.productImage.findMany({
      where: { productItemId: productId },
      orderBy: { id: 'asc' },
      select: { id: true },
    });

    if (!imgs.length) {
      this.logger.warn(`Product ${productId} has no ProductImage rows`);
      return;
    }

    // Ensure frontFacingFlags is a valid array:
    // If the provided array is not an array or its length mismatches the number of images,
    // default all images to false (or change to true if desired).
    const validFlags: boolean[] =
      Array.isArray(frontFacingFlags) && frontFacingFlags.length === imgs.length
        ? frontFacingFlags
        : Array(imgs.length).fill(false);

    // Update each image's frontFacing flag in parallel
    await Promise.all(
      imgs.map((img, idx) =>
        this.db.productImage.update({
          where: { id: img.id },
          data: { frontFacing: validFlags[idx] },
        }),
      ),
    );

    // Update product row embedding field
    await this.db.productItem.update({
      where: { id: productId },
      data: { embedding: embeddingConfig },
    });
  }
}
