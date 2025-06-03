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

interface EmbeddingQdrantBatchResult {
  embeddingResults: EmbedResponseDto[];
  qdrantResults: {
    totalProcessed: number;
    totalSuccessful: number;
    totalFailed: number;
    textStored: number;
    imageStored: number;
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
  ): Promise<QdrantSearchResponse> {
    const embedding = await this.embeddingService.generateTextEmbedding(query);
    return await this.qdrantService.search({
      collection: CollectionType.TEXT_EMBEDDINGS,
      ...params,
      vector: embedding,
    });
  }

  /**
   * Search by image.
   */
  async searchByImage(
    file: Express.Multer.File,
    params: SearchDto,
  ): Promise<QdrantSearchResponse> {
    if (!file) {
      throw new HttpException('No image file provided', HttpStatus.BAD_REQUEST);
    }
    const imageResponse =
      await this.embeddingService.generateImageEmbedding(file);
    if (imageResponse.label === 'front') {
      return await this.qdrantService.search({
        collection: CollectionType.IMAGE_FRONT_EMBEDDINGS,
        ...params,
        vector: imageResponse.embedding,
      });
    } else if (imageResponse.label === 'back') {
      return await this.qdrantService.search({
        collection: CollectionType.IMAGE_BACK_EMBEDDINGS,
        ...params,
        vector: imageResponse.embedding,
      });
    }
    throw new HttpException('Invalid image label', HttpStatus.BAD_REQUEST);
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
        product_id: productId,
        vector: frontEmbedding,
        ...metadata,
        category: metadata.category.filter((cat) => cat !== null), // Filter out null values
      });
    }
    if (backEmbedding) {
      return this.qdrantService.insertVector({
        collection: CollectionType.IMAGE_BACK_EMBEDDINGS,
        product_id: productId,
        vector: backEmbedding,
        ...metadata,
        category: metadata.category.filter((cat) => cat !== null), // Filter out null values
      });
    }
    if (textEmbedding) {
      return this.qdrantService.insertVector({
        collection: CollectionType.TEXT_EMBEDDINGS,
        product_id: productId,
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
}
