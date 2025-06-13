// backend/src/embedding/embedding.controller.ts

import {
  TextSearchDto,
  SearchDto,
  SimilarProductDto,
  ProcessProductDto,
  ProcessProductResponseDto,
  BatchEmbedRetailerDto,
  EmbeddingQdrantBatchResult,
} from './dto/embedding-qdrant.dto';
import { ProductItemTransferDto } from '../product-item/dto/product-item.dto';
import { Public } from '../types';
import {
  Controller,
  Post,
  Body,
  Logger,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { EmbeddingQdrantService } from './embedding-qdrant.service';
import { QdrantService } from '../qdrant/qdrant.service';

@Controller('embedding-qdrant')
export class EmbeddingQdrantController {
  private readonly logger = new Logger(EmbeddingQdrantController.name);

  constructor(
    private readonly embeddingQdrantService: EmbeddingQdrantService,
    private readonly qdrantService: QdrantService,
  ) {}

  /**
   * POST /api/embedding-qdrant/search-text
   * Accepts { "text": "some query", ...filters } and returns matching products
   */
  @Public()
  @Post('search-text')
  async searchText(
    @Body() request: TextSearchDto,
  ): Promise<ProductItemTransferDto[]> {
    const { text, ...filters } = request;
    return this.embeddingQdrantService.searchByText(text, filters);
  }

  /**
   * POST /api/embedding-qdrant/search-image
   * Accepts an image file and returns matching products
   */
  @Public()
  @Post('search-image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(), // keep in RAM so "file.buffer" is available
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    }),
  )
  async searchImage(
    @UploadedFile() image: Express.Multer.File,
    @Body() filters: SearchDto,
  ): Promise<ProductItemTransferDto[]> {
    return this.embeddingQdrantService.searchByImage(image, filters);
  }

  /**
   * POST /api/embedding-qdrant/batch-embed-retailer
   * Body: { "retailer": "Universal Store" }
   */
  @Public()
  @Post('batch-embed-retailer')
  async batchEmbedRetailer(
    @Body() dto: BatchEmbedRetailerDto,
  ): Promise<EmbeddingQdrantBatchResult> {
    this.logger.log(
      `Received batch-embed-retailer request for: ${dto.retailer} (batchSize=${dto.batchSize ?? 32}, concurrency=${dto.concurrency ?? 32})`,
    );
    return this.embeddingQdrantService.generateAndStoreEmbeddingsForRetailer(
      dto.retailer,
      dto.batchSize ?? 32,
      dto.concurrency ?? 32,
    );
  }

  /**
   * POST /api/embedding-qdrant/similar-product
   * Finds similar products based on productId by querying Qdrant
   */
  @Public()
  @Post('similar-product')
  async similarProduct(
    @Body() request: SimilarProductDto,
  ): Promise<{ id: number; distance: number }[]> {
    const { productId, ...filters } = request;
    return this.qdrantService.searchProduct({ productId, searchDto: filters });
  }

  /**
   * POST /api/embedding-qdrant/process-product
   * Process a product to generate embeddings and store in DB + Qdrant
   */
  @Public()
  @Post('process-product')
  async processProduct(
    @Body() request: ProcessProductDto,
  ): Promise<ProcessProductResponseDto> {
    try {
      this.logger.log(`Processing product ${request.productId}...`);

      const result = await this.embeddingQdrantService.processProductEmbedding(
        request.productId,
      );

      return {
        success: true,
        message: `Product ${request.productId} processed successfully`,
        productId: request.productId,
        embeddings: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to process product ${request.productId}:`,
        error,
      );

      return {
        success: false,
        message: `Failed to process product ${request.productId}: ${error}`,
        productId: request.productId,
      };
    }
  }

  @Public()
  @Post('generate-style-embeddings')
  async generateStyleEmbeddings() {
    return await this.embeddingQdrantService.generateStyleEmbeddings();
  }
}
