// backend/src/embedding/embedding.controller.ts

import {
  Controller,
  Post,
  Body,
  Logger,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { EmbeddingQdrantService } from './embedding-qdrant.service';
import { SearchDto } from './dto/embedding-qdrant.dto';
import { ProductItemTransferDto } from 'src/product-item/dto/product-item.dto';
import { QdrantService } from 'src/qdrant/qdrant.service';

@Controller('embedding-qdrant')
export class EmbeddingQdrantController {
  private readonly logger = new Logger(EmbeddingQdrantController.name);

  constructor(
    private readonly embeddingQdrantService: EmbeddingQdrantService,
    private readonly qdrantService: QdrantService, // Assuming this is the correct service for Qdrant operations
  ) {}

  /**
   * POST /api/embedding/generate-text-input-embedding
   *
   * Accepts a JSON body { "text": "some query" } and returns a 512-dim array.
   */
  @Post('search-text')
  async searchText(
    @Body() text: string,
    filters: SearchDto,
  ): Promise<ProductItemTransferDto[]> {
    return this.embeddingQdrantService.searchByText(text, filters);
  }

  /**
   * POST to generate response for image search.
   */
  @Post('search-image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(), // keep in RAM so “file.buffer” is available
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    }),
  )
  async searchImage(
    @UploadedFile() image: Express.Multer.File,
    filters: SearchDto,
  ): Promise<ProductItemTransferDto[]> {
    return this.embeddingQdrantService.searchByImage(image, filters);
  }

  /**
   * POST to generate response productInput. This post should use some sort of preference
   * to find similar products based on the productId and the different embedding qdrants it contains.
   * Probably concatinate the product list and the scale to produce a overall score.
   */
  @Post('similar-product')
  async similarProduct(
    @Body() productId: number,
    filters: SearchDto,
  ): Promise<ProductItemTransferDto[]> {
    const product = await this.qdrantService.searchProduct(productId, filters);
  }
}
