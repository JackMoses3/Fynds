/* eslint-disable */
import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

import { EmbeddingService } from '../embedding/embedding.service';
import { QdrantService } from '../qdrant/qdrant.service';
import { DatabaseService } from '../database/database.service';

import { CollectionType, Gender } from '../qdrant/dto/qdrant.dto';
import { MultimodalStyleClassificationResponse } from './dto/embedding-style.dto';
import {
  QdrantFilter,
  QdrantInsertResponse,
  QdrantSearchResponse,
} from '../qdrant/models/qdrant.model';

import { EmbedResponseDto } from '../embedding/dto/embeded-response.dto';

import {
  SearchDto,
  EmbeddingQdrantBatchResult,
} from './dto/embedding-qdrant.dto';

import { ProductItemTransferDto } from '../product-item/dto/product-item.dto';
import {
  StyleAnalysisConfig,
  WeightedStyleScore,
  StyleAnalysisResult,
} from './dto/multimodal-style-classification.dto';
import { FilterProductItemDto } from '../product-item/dto/filter.dto';
import { QdrantFilterModel } from '../qdrant/models/filter.model';

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
    userId: number | null,
    query: string,
    filters: FilterProductItemDto,
  ): Promise<ProductItemTransferDto[]> {
    console.log('🔍 [EmbeddingQdrantService] Starting hybrid text search');
    console.log('🔍 [EmbeddingQdrantService] Query:', query);
    console.log(
      '🔍 [EmbeddingQdrantService] Filters:',
      JSON.stringify(filters, null, 2),
    );

    try {
      const searchStart = Date.now();

      // Generate text embedding for the query
      const queryEmbedding =
        await this.embeddingService.generateTextEmbedding(query);
      console.log(
        '✅ [EmbeddingQdrantService] Generated text embedding with',
        queryEmbedding.length,
        'dimensions',
      );

      const topK = 50; // Return top 50 results

      // Build the search parameters for Qdrant
      const searchParams = {
        vector: queryEmbedding,
        top_k: Math.ceil(topK * 0.6), // 60% from text (30 results)
        ...filters,
      };

      const imageSearchParams = {
        vector: queryEmbedding,
        top_k: Math.ceil(topK * 0.4), // 40% from images (20 results)
        ...filters,
      };

      // ✅ HYBRID SEARCH: Search both text and image collections
      const [textResults, imageResults] = await Promise.all([
        // Search text embeddings (product descriptions, metadata)
        this.qdrantService
          .search({
            collection: CollectionType.TEXT_EMBEDDINGS,
            ...searchParams,
          })
          .then((response) => ({
            results: (response.results || []).map((r) => ({
              id: r.id,
              score: r.score || 0,
            })),
          }))
          .catch((error) => {
            console.warn(
              '⚠️ [EmbeddingQdrantService] Text search failed:',
              error.message,
            );
            return { results: [] };
          }),

        // Search image embeddings (visual similarity to text description)
        this.qdrantService
          .search({
            collection: CollectionType.IMAGE_FRONT_EMBEDDINGS,
            ...imageSearchParams,
          })
          .then((response) => ({
            results: (response.results || []).map((r) => ({
              id: r.id,
              score: r.score || 0,
            })),
          }))
          .catch((error) => {
            console.warn(
              '⚠️ [EmbeddingQdrantService] Image search failed:',
              error.message,
            );
            return { results: [] };
          }),
      ]);

      const searchEnd = Date.now();
      console.log(
        `⏱️ [EmbeddingQdrantService] Parallel search completed in ${searchEnd - searchStart}ms`,
      );
      console.log(
        `📊 [EmbeddingQdrantService] Results: Text=${textResults.results.length}, Images=${imageResults.results.length}`,
      );

      // Combine and deduplicate results with weighted scoring
      const allResults = [
        ...textResults.results.map((r) => ({
          ...r,
          score: r.score * 1.0,
          source: 'text',
        })), // Text weight: 1.0
        ...imageResults.results.map((r) => ({
          ...r,
          score: r.score * 1.0,
          source: 'image',
        })), // Image weight: 1.0
      ];

      const productScores = new Map<
        number,
        { id: number; score: number; sources: string[] }
      >();

      // Process results and handle duplicates by taking the best score
      allResults.forEach((result) => {
        const existing = productScores.get(result.id);
        if (existing) {
          // If product found in multiple collections, boost the score
          existing.score =
            Math.max(existing.score, result.score) + result.score * 0.1; // 10% boost for multimodal
          existing.sources.push(result.source);
        } else {
          productScores.set(result.id, {
            id: result.id,
            score: result.score,
            sources: [result.source],
          });
        }
      });

      const combinedResults = Array.from(productScores.values())
        .sort((a, b) => b.score - a.score) // Sort by relevance score
        .slice(0, topK); // Top 50 results

      console.log('📊 [EmbeddingQdrantService] Top 10 hybrid results:');
      combinedResults.slice(0, 10).forEach((result, index) => {
        console.log(
          `   ${index + 1}. ID=${result.id} | Score=${result.score.toFixed(4)} | Sources=[${result.sources.join(', ')}]`,
        );
      });

      if (!combinedResults.length) {
        console.log(
          '⚠️ [EmbeddingQdrantService] No products found matching query',
        );
        throw new HttpException(
          'No products matched your search',
          HttpStatus.NOT_FOUND,
        );
      }

      // Fetch product details from database
      const dbStart = Date.now();
      const products = await this.db.productItem.findMany({
        where: { id: { in: combinedResults.map((r) => r.id) } },
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

      const dbEnd = Date.now();
      console.log(
        `⏱️ [EmbeddingQdrantService] Database fetch completed in ${dbEnd - dbStart}ms`,
      );

      // Maintain search result order from similarity ranking
      const productMap = new Map(products.map((p) => [p.id, p]));
      const orderedProducts = combinedResults
        .map((result) => productMap.get(result.id))
        .filter((p): p is NonNullable<typeof p> => p !== undefined);

      console.log(
        `🎯 [EmbeddingQdrantService] Final results: ${orderedProducts.length} products ordered by hybrid relevance`,
      );
      console.log('📋 [EmbeddingQdrantService] Top 5 final products:');
      orderedProducts.slice(0, 5).forEach((product, index) => {
        console.log(
          `   ${index + 1}. "${product.name}" (${product.brand}) - ${product.retailer}`,
        );
      });

      // Return formatted results
      return orderedProducts.map((p) => ({
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
    } catch (error) {
      console.error(
        '❌ [EmbeddingQdrantService] Error in hybrid text search:',
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Search failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async searchByImage(
    userId: number | null,
    image: Express.Multer.File,
    filters: FilterProductItemDto,
  ): Promise<ProductItemTransferDto[]> {
    try {
      const searchStart = Date.now();

      // 1. Generate image embedding using ML service
      const imageEmbeddingResult =
        await this.embeddingService.generateImageEmbedding(image);

      // 2. Determine which collection to search based on front/back classification
      const searchCollection =
        imageEmbeddingResult.label === 'front'
          ? CollectionType.IMAGE_FRONT_EMBEDDINGS
          : CollectionType.IMAGE_BACK_EMBEDDINGS;

      // 3. Search for similar images in the appropriate collection
      const topK = 50;
      const searchResults = await this.qdrantService.search({
        collection: searchCollection,
        vector: imageEmbeddingResult.embedding,
        top_k: topK,
        ...filters,
      });

      if (!searchResults.results || searchResults.results.length === 0) {
        return [];
      }

      // 4. Get product IDs and fetch full product details
      const productIds = searchResults.results
        .map((result) => result.id)
        .filter((id) => id != null);

      const products = await this.db.productItem.findMany({
        where: { id: { in: productIds } },
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

      // 5. Maintain search result order from similarity ranking
      const productMap = new Map(products.map((p) => [p.id, p]));
      const orderedProducts = productIds
        .map((id) => productMap.get(id))
        .filter((p): p is NonNullable<typeof p> => p !== undefined);

      // 6. Return formatted results
      return orderedProducts.map((p) => ({
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
    } catch (error) {
      throw new HttpException(
        `Image search failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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
        product_id: productId,
        vector: frontEmbedding,
        ...metadata,
      });
    }
    if (backEmbedding) {
      this.qdrantService.insertVector({
        collection: CollectionType.IMAGE_BACK_EMBEDDINGS,
        product_id: productId,
        vector: backEmbedding,
        ...metadata,
      });
    }
    if (textEmbedding) {
      this.qdrantService.insertVector({
        collection: CollectionType.TEXT_EMBEDDINGS,
        product_id: productId,
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

  /**
   * Generate embeddings for all styles and store them in Qdrant
   */
  async generateStyleEmbeddings(): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    this.logger.log('🎨 Starting style embeddings generation...');

    // Get all styles from database
    const styles = await this.db.style.findMany({
      select: {
        id: true,
        name: true,
        description: true,
      },
    });

    this.logger.log(`📋 Found ${styles.length} styles to process`);

    let successful = 0;
    let failed = 0;

    for (const style of styles) {
      try {
        // Create text for embedding
        const styleText = style.description
          ? `${style.name}. ${style.description}`
          : style.name;

        // Generate embedding
        const embedding =
          await this.embeddingService.generateTextEmbedding(styleText);

        // Store in Qdrant
        await this.qdrantService.addStyle(style.id, style.name, embedding);

        this.logger.log(`✅ Processed style: ${style.name}`);
        successful++;
      } catch (error) {
        this.logger.error(`❌ Failed to process style ${style.name}: ${error}`);
        failed++;
      }
    }

    this.logger.log(`🏁 Complete: ${successful} successful, ${failed} failed`);

    return {
      processed: styles.length,
      successful,
      failed,
    };
  }

  /**
   * Test multimodal style classification for a product
   */
  async testMultimodalStyleClassification(
    productId: number,
    topK: number = 5,
    minConfidence: number = 0.0,
  ): Promise<MultimodalStyleClassificationResponse> {
    this.logger.log(
      `🔍 Testing multimodal style classification for product ${productId}`,
    );

    try {
      // Call ML service for multimodal classification
      const { data } = await axios.post(
        `${process.env.ML_URL}/api/v1/vector/classify_multimodal_style`,
        {
          product_id: productId,
          top_k: topK,
          min_confidence: minConfidence,
        },
        { timeout: 30_000 },
      );

      this.logger.log(`🎯 Classification complete for product ${productId}`);
      this.logger.log(
        `📊 Found ${data.total_modalities} modalities with ${data.total_unique_styles} unique styles`,
      );

      // Log results for each modality
      if (data.results.text_styles) {
        this.logger.log(
          `📝 Text styles (${data.results.text_styles.count}): ${data.results.text_styles.styles
            .map(
              (s: { style_name: string; similarity_score: number }) =>
                `${s.style_name}(${s.similarity_score})`,
            )
            .join(', ')}`,
        );
      }
      if (data.results.image_front_styles) {
        this.logger.log(
          `🖼️ Front image styles (${data.results.image_front_styles.count}): ${data.results.image_front_styles.styles
            .map(
              (s: { style_name: string; similarity_score: number }) =>
                `${s.style_name}(${s.similarity_score})`,
            )
            .join(', ')}`,
        );
      }
      if (data.results.image_back_styles) {
        this.logger.log(
          `🖼️ Back image styles (${data.results.image_back_styles.count}): ${data.results.image_back_styles.styles
            .map(
              (s: { style_name: string; similarity_score: number }) =>
                `${s.style_name}(${s.similarity_score})`,
            )
            .join(', ')}`,
        );
      }

      return data;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `❌ Multimodal classification failed for product ${productId}: ${error.message}`,
      );
      throw new HttpException(
        `Multimodal classification failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Analyze multimodal style classification and determine best styles for a product
   */
  async analyzeAndUpdateProductStyles(
    productId: number,
    config: StyleAnalysisConfig = new StyleAnalysisConfig(),
    dryRun: boolean = false,
  ): Promise<StyleAnalysisResult> {
    this.logger.log(
      `🔍 Analyzing styles for product ${productId} (dryRun: ${dryRun})`,
    );

    // Get multimodal classification
    const classification = await this.testMultimodalStyleClassification(
      productId,
      10,
      0.1,
    );

    // Get current product styles
    const currentProduct = await this.db.productItem.findUnique({
      where: { id: productId },
      include: {
        productStyles: {
          include: { style: true },
        },
      },
    });

    if (!currentProduct) {
      throw new HttpException(
        `Product ${productId} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    const currentStyleIds = currentProduct.productStyles.map(
      (ps) => ps.style.id,
    );

    // Calculate weighted scores
    const weightedStyles = this.calculateWeightedStyleScores(
      classification,
      config,
    );

    // Determine styles to add/remove
    const stylesToAdd = weightedStyles
      .filter((ws) => ws.weighted_score >= config.updateThreshold)
      .filter((ws) => ws.modalities_count >= config.requireMinModalities)
      .slice(0, config.maxStyles)
      .map((ws) => ws.style_id)
      .filter((styleId) => !currentStyleIds.includes(styleId));

    // For removal, you might want to be more conservative
    // Only remove styles that score very low across all modalities
    const stylesToRemove = currentStyleIds.filter((currentStyleId) => {
      const foundStyle = weightedStyles.find(
        (ws) => ws.style_id === currentStyleId,
      );
      return (
        foundStyle && foundStyle.weighted_score < config.updateThreshold * 0.5
      );
    });

    const analysisResult: StyleAnalysisResult = {
      product_id: productId,
      recommended_styles: weightedStyles,
      styles_to_add: stylesToAdd,
      styles_to_remove: stylesToRemove,
      current_styles: currentStyleIds,
      analysis_summary: {
        total_candidates: weightedStyles.length,
        above_threshold: weightedStyles.filter(
          (ws) => ws.weighted_score >= config.updateThreshold,
        ).length,
        modalities_analyzed: classification.total_modalities,
        confidence_distribution: {
          high: weightedStyles.filter((ws) => ws.confidence === 'high').length,
          medium: weightedStyles.filter((ws) => ws.confidence === 'medium')
            .length,
          low: weightedStyles.filter((ws) => ws.confidence === 'low').length,
        },
      },
    };

    this.logger.log(
      `📊 Analysis complete: ${stylesToAdd.length} to add, ${stylesToRemove.length} to remove`,
    );

    // Apply changes if not dry run
    if (!dryRun && (stylesToAdd.length > 0 || stylesToRemove.length > 0)) {
      await this.updateProductStyles(productId, stylesToAdd, stylesToRemove);
      this.logger.log(`✅ Product ${productId} styles updated successfully`);
    }

    return analysisResult;
  }

  /**
   * Calculate weighted scores for styles across all modalities
   */
  private calculateWeightedStyleScores(
    classification: MultimodalStyleClassificationResponse,
    config: StyleAnalysisConfig,
  ): WeightedStyleScore[] {
    const styleScores = new Map<
      number,
      {
        style_id: number;
        style_name: string;
        text_score?: number;
        front_score?: number;
        back_score?: number;
        modalities: number;
      }
    >();

    // Collect scores from each modality
    if (classification.results.text_styles) {
      classification.results.text_styles.styles.forEach((style) => {
        const existing = styleScores.get(style.style_id) || {
          style_id: style.style_id,
          style_name: style.style_name,
          modalities: 0,
        };
        existing.text_score = style.similarity_score;
        existing.modalities++;
        styleScores.set(style.style_id, existing);
      });
    }

    if (classification.results.image_front_styles) {
      classification.results.image_front_styles.styles.forEach((style) => {
        const existing = styleScores.get(style.style_id) || {
          style_id: style.style_id,
          style_name: style.style_name,
          modalities: 0,
        };
        existing.front_score = style.similarity_score;
        existing.modalities++;
        styleScores.set(style.style_id, existing);
      });
    }

    if (classification.results.image_back_styles) {
      classification.results.image_back_styles.styles.forEach((style) => {
        const existing = styleScores.get(style.style_id) || {
          style_id: style.style_id,
          style_name: style.style_name,
          modalities: 0,
        };
        existing.back_score = style.similarity_score;
        existing.modalities++;
        styleScores.set(style.style_id, existing);
      });
    }

    // Calculate weighted scores
    return Array.from(styleScores.values())
      .map((style) => {
        const textScore = (style.text_score || 0) * config.textWeight;
        const frontScore = (style.front_score || 0) * config.frontImageWeight;
        const backScore = (style.back_score || 0) * config.backImageWeight;

        // Normalize by the weights of modalities that actually contributed
        let totalWeight = 0;
        if (style.text_score) totalWeight += config.textWeight;
        if (style.front_score) totalWeight += config.frontImageWeight;
        if (style.back_score) totalWeight += config.backImageWeight;

        const weightedScore =
          totalWeight > 0
            ? (textScore + frontScore + backScore) / totalWeight
            : 0;

        // Determine confidence based on modalities and score
        let confidence: 'high' | 'medium' | 'low' = 'low';
        if (style.modalities >= 3 && weightedScore >= 0.8) confidence = 'high';
        else if (style.modalities >= 2 && weightedScore >= 0.6)
          confidence = 'medium';

        return {
          style_id: style.style_id,
          style_name: style.style_name,
          weighted_score: weightedScore,
          modality_scores: {
            text: style.text_score,
            front_image: style.front_score,
            back_image: style.back_score,
          },
          modalities_count: style.modalities,
          confidence,
        };
      })
      .sort((a, b) => b.weighted_score - a.weighted_score);
  }

  /**
   * Update product styles in database
   */
  private async updateProductStyles(
    productId: number,
    stylesToAdd: number[],
    stylesToRemove: number[],
  ): Promise<void> {
    this.logger.log(
      `Updating product ${productId} styles: add ${stylesToAdd.length}, remove ${stylesToRemove.length}`,
    );

    // Add new styles
    if (stylesToAdd.length > 0) {
      await this.db.productStyle.createMany({
        data: stylesToAdd.map((styleId) => ({
          productItemId: productId,
          styleId,
        })),
      });
      this.logger.log(
        `Added ${stylesToAdd.length} styles to product ${productId}`,
      );
    }

    // Remove old styles
    if (stylesToRemove.length > 0) {
      await this.db.productStyle.deleteMany({
        where: {
          productItemId: productId,
          styleId: { in: stylesToRemove },
        },
      });
      this.logger.log(
        `Removed ${stylesToRemove.length} styles from product ${productId}`,
      );
    }
  }

  /**
   * Process all products and update their styles using multimodal analysis
   */
  async processAllProductsForStyleUpdate(
    config: StyleAnalysisConfig = new StyleAnalysisConfig(),
    options: {
      batchSize?: number;
      retailer?: string;
      category?: string;
      brand?: string;
      dryRun?: boolean;
      skipProductsWithStyles?: boolean;
      maxProducts?: number;
    } = {},
  ): Promise<{
    processed: number;
    successful: number;
    failed: number;
    skipped: number;
    results: Array<{
      productId: number;
      status: 'success' | 'failed' | 'skipped';
      error?: string;
      stylesAdded?: number;
      stylesRemoved?: number;
      analysisResult?: StyleAnalysisResult;
    }>;
  }> {
    const {
      batchSize = 50,
      retailer,
      category,
      brand,
      dryRun = false,
      skipProductsWithStyles = false,
      maxProducts,
    } = options;

    this.logger.log(
      `🚀 Starting bulk style update process (dryRun: ${dryRun})`,
    );
    this.logger.log(
      `📊 Config: threshold=${config.updateThreshold}, minModalities=${config.requireMinModalities}`,
    );

    // Build query filters
    const whereClause: any = {};
    if (retailer) whereClause.retailer = retailer;
    if (category) whereClause.category = category;
    if (brand) whereClause.brand = brand;

    if (skipProductsWithStyles) {
      whereClause.productStyles = {
        none: {},
      };
    }

    // Get total count first
    const totalProducts = await this.db.productItem.count({
      where: whereClause,
    });
    const productsToProcess = maxProducts
      ? Math.min(totalProducts, maxProducts)
      : totalProducts;

    this.logger.log(
      `📦 Found ${totalProducts} products, processing ${productsToProcess}`,
    );

    let processed = 0;
    let successful = 0;
    let failed = 0;
    let skipped = 0;
    const results: Array<{
      productId: number;
      status: 'success' | 'failed' | 'skipped';
      error?: string;
      stylesAdded?: number;
      stylesRemoved?: number;
      analysisResult?: StyleAnalysisResult;
    }> = [];

    // Process in batches to avoid memory issues
    for (let offset = 0; offset < productsToProcess; offset += batchSize) {
      const currentBatchSize = Math.min(batchSize, productsToProcess - offset);

      this.logger.log(
        `📋 Processing batch ${Math.floor(offset / batchSize) + 1}/${Math.ceil(
          productsToProcess / batchSize,
        )} (${offset + 1}-${offset + currentBatchSize})`,
      );

      const products = await this.db.productItem.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          brand: true,
          retailer: true,
          productStyles: {
            select: {
              styleId: true,
            },
          },
        },
        skip: offset,
        take: currentBatchSize,
      });

      // Process each product in the batch
      for (const product of products) {
        try {
          this.logger.log(
            `🔍 Processing product ${product.id}: ${product.name} (${product.brand})`,
          );
          // Analyze and update styles
          const analysisResult = await this.analyzeAndUpdateProductStyles(
            product.id,
            config,
            dryRun,
          );

          successful++;
          results.push({
            productId: product.id,
            status: 'success',
            stylesAdded: analysisResult.styles_to_add.length,
            stylesRemoved: analysisResult.styles_to_remove.length,
            analysisResult,
          });

          this.logger.log(
            `✅ Product ${product.id}: +${analysisResult.styles_to_add.length} styles, -${analysisResult.styles_to_remove.length} styles`,
          );
        } catch (error) {
          failed++;
          results.push({
            productId: product.id,
            status: 'failed',
            error: error.message,
          });
          this.logger.error(
            `❌ Failed to process product ${product.id}: ${error.message}`,
          );
        }

        processed++;

        // Add small delay to prevent overwhelming the system
        if (processed % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Log batch completion
      this.logger.log(
        `✅ Batch completed: ${successful}/${processed} successful`,
      );
    }

    const summary = {
      processed,
      successful,
      failed,
      skipped,
      results,
    };

    this.logger.log(`🎉 Bulk processing complete!`);
    this.logger.log(
      `📊 Results: ${successful} successful, ${failed} failed, ${skipped} skipped out of ${processed} processed`,
    );

    return summary;
  }

  /**
   * Process products by retailer (convenient wrapper)
   */
  async processProductsByRetailer(
    retailer: string,
    config: StyleAnalysisConfig = new StyleAnalysisConfig(),
    dryRun: boolean = false,
  ) {
    return this.processAllProductsForStyleUpdate(config, {
      retailer,
      dryRun,
      batchSize: 25, // Smaller batches for retailer-specific processing
    });
  }

  /**
   * Process only products without existing styles
   */
  async processProductsWithoutStyles(
    config: StyleAnalysisConfig = new StyleAnalysisConfig(),
    dryRun: boolean = false,
  ) {
    return this.processAllProductsForStyleUpdate(config, {
      skipProductsWithStyles: true,
      dryRun,
      batchSize: 100, // Larger batches since these are likely easier to process
    });
  }

  async getUserFilters(
    userId: number,
  ): Promise<{ gender: Gender[]; style: string[] }> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        clothingPreferences: true,
        userStyles: { select: { style: { select: { name: true } } } },
      },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    return {
      gender: [user.clothingPreferences as Gender],
      style: user.userStyles.map((s) => s.style.name),
    };
  }
}
