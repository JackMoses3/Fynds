/* eslint-disable */
import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { EmbeddingService } from '../embedding/embedding.service';
import { QdrantService } from '../qdrant/qdrant.service';
import pLimit from 'p-limit';
import {
  CollectionType,
  Gender,
  SearchVectorDto,
} from '../qdrant/dto/qdrant.dto';
import {
  QdrantSearchResponse,
  QdrantInsertResponse,
  QdrantDeleteResponse,
} from '../qdrant/models/qdrant.model';
import { EmbedResponseDto } from '../embedding/dto/embeded-response.dto';
import { DatabaseService } from '../database/database.service';
import { SearchDto } from './dto/embedding-qdrant.dto';
import { ProductItemTransferDto } from '../product-item/dto/product-item.dto';

interface EmbeddingQdrantBatchResult {
  embeddingResults: EmbedResponseDto[];
  qdrantResults: {
    totalProcessed: number;
    totalSuccessful: number;
    totalFailed: number;
    errors: Array<{ productId: number; error: string; type: string }>;
  };
  timeElapsed: number;
}

@Injectable()
export class EmbeddingQdrantService {
  private readonly logger = new Logger(EmbeddingQdrantService.name);

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly qdrantService: QdrantService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * Generate embeddings for retailer and store them in Qdrant in batches
   */
  async generateAndStoreEmbeddingsForRetailer(
    retailer: string,
  ): Promise<EmbeddingQdrantBatchResult> {
    const startTime = Date.now();

    this.logger.log(
      `🚀 Starting embedding generation and Qdrant storage for retailer: ${retailer}`,
    );

    // Step 1: Generate embeddings using existing service
    const embeddingBatchResult =
      await this.embeddingService.generateProductEmbeddingPerRetailer(retailer);

    this.logger.log(
      `📊 Generated ${embeddingBatchResult.embeddingResults.length} embeddings, now storing in Qdrant...`,
    );

    // Step 2: Store embeddings in Qdrant in batches
    const qdrantResults = await this.storeEmbeddingBatchInQdrant(
      embeddingBatchResult.embeddingResults,
    );

    const timeElapsed = Date.now() - startTime;

    this.logger.log(
      `🏁 Complete! Generated ${embeddingBatchResult.embeddingResults.length} embeddings, ` +
        `stored ${qdrantResults.totalSuccessful}/${qdrantResults.totalProcessed} in Qdrant`,
    );

    return {
      embeddingResults: embeddingBatchResult.embeddingResults,
      qdrantResults,
      timeElapsed,
    };
  }

  /**
   * Store a batch of embeddings in Qdrant
   */

  /**
   * search by text query
   */
  async searchByText(
    query: string,
    params: SearchDto,
  ): Promise<ProductItemTransferDto[]> {
    const embedding = await this.embeddingService.generateTextEmbedding(query);
    const productIds = await this.qdrantService.search({
      collection: CollectionType.TEXT_EMBEDDINGS,
      ...params,
      vector: embedding,
    });
    if (!productIds || productIds.results.length === 0) {
      throw new HttpException(
        'No products found for the given query',
        HttpStatus.NOT_FOUND,
      );
    }
    const products = await this.db.productItem.findMany({
      where: {
        id: { in: productIds.results.map((p) => p.id) },
      },
      select: {
        id: true,
        name: true,
        brand: true,
        category: true,
        price: true,
        retailer: true,
        url: true,
        productStyles: {
          select: {
            style: { select: { name: true } },
          },
        },
        productImages: {
          select: { id: true, imageUrl: true, frontFacing: true },
          orderBy: { id: 'asc' }, // Ensure images are ordered by ID
        },
      },
    });
    if (!products || products.length === 0) {
      throw new HttpException(
        'No products found for the given query',
        HttpStatus.NOT_FOUND,
      );
    }
    return products.map((product) => ({
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      price: product.price,
      retailer: product.retailer,
      style: product.productStyles?.map((ps) => ps.style.name) || [],
      images: product.productImages.map((img) => ({
        id: img.id,
        imageUrl: img.imageUrl,
        frontFacing: img.frontFacing,
      })),
      url: product.url, // Ensure URL is included',
    }));
  }

  /**
   * Search by image.
   */
  async searchByImage(
    file: Express.Multer.File,
    params: SearchDto,
  ): Promise<ProductItemTransferDto[]> {
    if (!file) {
      throw new HttpException('No image file provided', HttpStatus.BAD_REQUEST);
    }

    const imageResponse =
      await this.embeddingService.generateImageEmbedding(file);
    let productIds: QdrantSearchResponse;

    // Search in the appropriate collection based on image label
    if (imageResponse.label === 'front') {
      productIds = await this.qdrantService.search({
        collection: CollectionType.IMAGE_FRONT_EMBEDDINGS,
        ...params,
        vector: imageResponse.embedding,
      });
    } else if (imageResponse.label === 'back') {
      productIds = await this.qdrantService.search({
        collection: CollectionType.IMAGE_BACK_EMBEDDINGS,
        ...params,
        vector: imageResponse.embedding,
      });
    } else {
      throw new HttpException(
        `Invalid image label: ${imageResponse.label}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check if we got any results
    if (!productIds || productIds.results.length === 0) {
      throw new HttpException(
        'No products found for the given query',
        HttpStatus.NOT_FOUND,
      );
    }

    // Fetch product details from database
    const products = await this.db.productItem.findMany({
      where: {
        id: { in: productIds.results.map((p) => p.id) },
      },
      select: {
        id: true,
        name: true,
        brand: true,
        category: true,
        price: true,
        retailer: true,
        url: true,
        productStyles: {
          select: {
            style: { select: { name: true } },
          },
        },
        productImages: {
          select: { id: true, imageUrl: true, frontFacing: true },
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!products || products.length === 0) {
      throw new HttpException(
        'No products found for the given query',
        HttpStatus.NOT_FOUND,
      );
    }

    // Transform and return the results
    return products.map((product) => ({
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      price: product.price,
      retailer: product.retailer,
      style: product.productStyles?.map((ps) => ps.style.name) || [],
      images: product.productImages.map((img) => ({
        id: img.id,
        imageUrl: img.imageUrl,
        frontFacing: img.frontFacing,
      })),
      url: product.url,
    }));
  }

  /**
   * adding a product embedding response to Qdrant
   */
  async addProductEmbedding(
    embedding: EmbedResponseDto,
  ): Promise<QdrantInsertResponse> {
    const {
      productId,
      frontEmbedding,
      backEmbedding,
      textEmbedding,
      frontFacingImages,
    } = embedding;

    // product data based on productId
    const product = await this.db.productItem.findUnique({
      where: { id: productId },
      select: {
        price: true,
        brand: true,
        category: true,
        sex: true,
        retailer: true,
        productStyles: {
          select: {
            style: { select: { name: true } },
          },
        },
      },
    });

    if (!product) {
      throw new HttpException(
        `Product with ID ${productId} not found`,
        HttpStatus.NOT_FOUND,
      );
    }
    // prepare metadata
    const metadata = {
      style: product.productStyles?.map((ps) => ps.style.name) || [],
      price: product.price,
      category: [product.category],
      gender: [product.sex as Gender],
      brand: [product.brand],
      retailer: [product.retailer],
    };
    const embeddingString =
      this.embeddingService.determineEmbeddingConfig(embedding);
    this.updateProduct(productId, frontFacingImages, embeddingString);

    if (embeddingString === null) {
      throw new HttpException(
        `No embedding found for product ${productId}`,
        HttpStatus.NOT_FOUND,
      );
    }
    // insert imbeddings
    if (frontEmbedding) {
      return this.qdrantService.insertVector({
        collection: CollectionType.IMAGE_FRONT_EMBEDDINGS,
        productId: productId,
        vector: frontEmbedding,
        ...metadata,
        category: metadata.category.filter((cat) => cat !== null), // Filter out null values
      });
    }
    if (backEmbedding) {
      return this.qdrantService.insertVector({
        collection: CollectionType.IMAGE_BACK_EMBEDDINGS,
        productId: productId,
        vector: backEmbedding,
        ...metadata,
        category: metadata.category.filter((cat) => cat !== null), // Filter out null values
      });
    }
    if (textEmbedding) {
      return this.qdrantService.insertVector({
        collection: CollectionType.TEXT_EMBEDDINGS,
        productId: productId,
        vector: textEmbedding,
        ...metadata,
        category: metadata.category.filter((cat) => cat !== null), // Filter out null values
      });
    }
    throw new HttpException(
      `No valid embedding found for product ${productId}`,
      HttpStatus.NOT_FOUND,
    );
  }

  private async updateProduct(
    productId: number,
    frontFacingImages: boolean[],
    embedding: string | null,
  ): Promise<void> {
    try {
      // Get all product images ordered by ID (ascending)
      const productImages = await this.db.productImage.findMany({
        where: { productItemId: productId },
        orderBy: { id: 'asc' },
        select: { id: true },
      });

      if (productImages.length === 0) {
        this.logger.warn(`No product images found for product ${productId}`);
        return;
      }

      if (frontFacingImages.length !== productImages.length) {
        this.logger.warn(
          `Mismatch: Product ${productId} has ${productImages.length} images but ` +
            `${frontFacingImages.length} frontFacing values provided`,
        );
      }

      // Update each image with its corresponding frontFacing value
      const updatePromises = productImages.map((image, index) => {
        // Use true as default if frontFacingImages array is shorter
        const isFrontFacing =
          index < frontFacingImages.length ? frontFacingImages[index] : true;

        return this.db.productImage.update({
          where: { id: image.id },
          data: { frontFacing: isFrontFacing },
        });
      });

      await Promise.all(updatePromises);

      await this.db.productItem.update({
        where: { id: productId },
        data: {
          embedding: embedding,
        },
      });
      this.logger.log(
        `✅ Updated ${productImages.length} product images for product ${productId} with frontFacing data`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to update product images for product ${productId}: ${error.message}`,
      );
      throw error;
    }
  }

  async storeEmbeddingBatchInQdrant(embeddings: EmbedResponseDto[]): Promise<{
    totalProcessed: number;
    totalSuccessful: number;
    totalFailed: number;

    errors: Array<{ productId: number; error: string; type: string }>;
  }> {
    const concurrencyLimit = 30;
    const limit = pLimit(concurrencyLimit);

    let totalProcessed = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;
    const errors: Array<{ productId: number; error: string; type: string }> =
      [];

    const promises = embeddings.map((embedding) =>
      limit(async () => {
        totalProcessed++;
        try {
          const response = await this.addProductEmbedding(embedding);
          if (response.status === 'success') {
            totalSuccessful++;
          } else {
            throw new Error(`Qdrant insert failed: ${response}`);
          }
        } catch (error) {
          totalFailed++;
          errors.push({
            productId: embedding.productId,
            error: error.message || 'Unknown error',
            type: embedding.textEmbedding ? 'text' : 'image',
          });
        }
      }),
    );

    await Promise.all(promises);

    return {
      totalProcessed,
      totalSuccessful,
      totalFailed,
      errors,
    };
  }
}
