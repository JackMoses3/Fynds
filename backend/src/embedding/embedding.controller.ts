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
import { EmbeddingService } from './embedding.service';

@Controller('embedding')
export class EmbeddingController {
  private readonly logger = new Logger(EmbeddingController.name);

  constructor(private readonly embeddingService: EmbeddingService) {}

  /**
   * POST /api/embedding/generate-product-embedding
   *
   * Shortcut for “processPending” or “generate embeddings for one product.”
   * (You already had this wired up; no changes needed here.)
   */
  @Post('generate-product-embedding')
  async generateProductEmbedding() {
    this.logger.log('⏳ Called generate-product-embedding');
    const results = await this.embeddingService.generateProductEmbedding();
    this.logger.log(
      `✅ Finished generate-product-embedding (results: ${results.length})`,
    );
    return results;
  }

  /**
   * POST /api/embedding/generate-text-input-embedding
   *
   * Accepts a JSON body { "text": "some query" } and returns a 512-dim array.
   */
  @Post('generate-text-input-embedding')
  async generateTextInputEmbedding(
    @Body('text') text: string,
  ): Promise<{ embedding: number[] }> {
    this.logger.log(
      `⏳ Called generate-text-input-embedding with text="${text}"`,
    );
    const vec = await this.embeddingService.generateTextEmbedding(text);
    this.logger.log(
      `✅ Returning 512-dim embedding (first 3 dims: [${vec
        .slice(0, 3)
        .join(', ')}…])`,
    );
    return { embedding: vec };
  }

  /**
   * POST /api/embedding/generate-image-embedding
   *
   * Accepts a JSON body { "imageUrl": "https://example.com/image.jpg" }
   * and returns a 512-dim array.
   */
  @Post('generate-image-embedding')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(), // keep in RAM so “file.buffer” is available
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    }),
  )
  async generateImageEmbedding(@UploadedFile() image: Express.Multer.File) {
    if (!image) {
      throw new Error('No file uploaded. Field name must be "image".');
    }
    return this.embeddingService.generateImageEmbedding(image);
  }
}
