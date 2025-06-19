// backend/src/embedding/embedding.controller.ts

import {
  SimilarProductDto,
  ProcessProductResponseDto,
  BatchEmbedRetailerDto,
  EmbeddingQdrantBatchResult,
  ProcessProductDto,
} from './dto/embedding-qdrant.dto';
import { ProductItemTransferDto } from '../product-item/dto/product-item.dto';
import { Public, RequestUser } from '../types';
import {
  Controller,
  Post,
  Body,
  Logger,
  UseInterceptors,
  UploadedFile,
  HttpException,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { EmbeddingQdrantService } from './embedding-qdrant.service';
import { QdrantService } from '../qdrant/qdrant.service';
import {
  MultimodalStyleClassificationRequest,
  MultimodalStyleClassificationResponse,
} from './dto/embedding-style.dto';
import { StyleAnalysisConfig } from './dto/multimodal-style-classification.dto';
import { FilterProductItemDto } from '../product-item/dto/filter.dto';
import { TextSearchDto } from './dto/controller.dto';
import { JwtAuthGuard } from '../auth/strategies/jwt/jwt-auth.guard';

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
  @UseGuards(JwtAuthGuard) // Make sure the JWT guard is applied
  async searchText(
    @Req() req: RequestUser, // Changed from RequestUser to any for debugging
    @Body() request: TextSearchDto,
  ): Promise<ProductItemTransferDto[]> {
    console.log('🔍 [EmbeddingQdrantController] Search request received');
    console.log(
      '🔍 [EmbeddingQdrantController] Request body:',
      JSON.stringify(request, null, 2),
    );
    console.log('🔍 [EmbeddingQdrantController] Request user:', req.user);
    console.log(
      '🔍 [EmbeddingQdrantController] Full request keys:',
      Object.keys(req),
    );

    try {
      // Handle case where user might be undefined
      const userId = req.user?.sub || null;
      console.log('🔍 [EmbeddingQdrantController] Using userId:', userId);

      const results = await this.embeddingQdrantService.searchByText(
        userId,
        request.query,
        request.filters || {},
      );

      console.log(
        '✅ [EmbeddingQdrantController] Search completed, found:',
        results.length,
        'products',
      );
      return results;
    } catch (error) {
      console.error('❌ [EmbeddingQdrantController] Search error:', error);
      throw error;
    }
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
    @Req() req: RequestUser,
    @Body() filters: FilterProductItemDto,
  ): Promise<ProductItemTransferDto[]> {
    return this.embeddingQdrantService.searchByImage(
      req.user.sub,
      image,
      filters,
    );
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
    @Req() req: RequestUser,
    @Body() request: SimilarProductDto,
  ): Promise<{ id: number; distance: number }[]> {
    const { productId, ...filters } = request;
    const searchDto = filters.searchDto || { top_k: 10 };
    return this.qdrantService.searchProduct({ productId, searchDto });
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
  @Public()
  @Post('test-multimodal-classification')
  async testMultimodalClassification(
    @Body()
    body: MultimodalStyleClassificationRequest,
  ): Promise<MultimodalStyleClassificationResponse> {
    const { productId, topK = 5, minConfidence = 0.0 } = body;

    if (!productId) {
      throw new HttpException('productId is required', HttpStatus.BAD_REQUEST);
    }

    this.logger.log(
      `🧪 Testing multimodal classification for product ${productId}`,
    );

    try {
      const result =
        await this.embeddingQdrantService.testMultimodalStyleClassification(
          productId,
          topK,
          minConfidence,
        );

      this.logger.log(
        `✅ Test completed successfully for product ${productId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`❌ Test failed for product `);
      throw error;
    }
  }
  @Public()
  @Post('analyze-and-update-styles')
  async analyzeAndUpdateStyles(
    @Body()
    body: {
      productId: number;
      config?: StyleAnalysisConfig;
      dryRun?: boolean;
    },
  ) {
    const {
      productId,
      config = new StyleAnalysisConfig(),
      dryRun = false,
    } = body;

    if (!productId) {
      throw new HttpException('productId is required', HttpStatus.BAD_REQUEST);
    }

    return await this.embeddingQdrantService.analyzeAndUpdateProductStyles(
      productId,
      config,
      dryRun,
    );
  }

  @Public()
  @Post('process-retailer-styles')
  async processRetailerStyles(
    @Body()
    body: {
      retailer: string;
      config?: StyleAnalysisConfig;
      dryRun?: boolean;
    },
  ) {
    const {
      retailer,
      config = new StyleAnalysisConfig(),
      dryRun = false,
    } = body;

    if (!retailer) {
      throw new HttpException('retailer is required', HttpStatus.BAD_REQUEST);
    }

    return await this.embeddingQdrantService.processProductsByRetailer(
      retailer,
      config,
      dryRun,
    );
  }
}
