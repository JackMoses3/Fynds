/* eslint-disable */
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import pLimit from 'p-limit'; // “npm install p-limit” or yarn add p-limit
import { EmbedRequestDto } from './dto/embeded-request.dto';
import { EmbedResponseDto } from './dto/embeded-response.dto';
import { DatabaseService } from '../database/database.service';
import { firstValueFrom } from 'rxjs';
import FormData from 'form-data';

export interface TextEmbedRequestDto {
  text: string;
}
export interface TextEmbedResponseDto {
  embedding: number[];
}

export interface ImageEmbedResponseDto {
  label: 'front' | 'back';
  embedding: number[];
}

export interface EmbeddingBatchResult {
  embeddingResults: EmbedResponseDto[];
  totalProcessed: number;
  totalSuccessful: number;
  totalFailed: number;
  errors: Array<{ productId: number; error: string }>;
  timeElapsed: number;
  lastProcessedId: number;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly baseUrl = process.env.ML_URL + '/api/v1/embedding';

  constructor(
    private readonly db: DatabaseService,
    private readonly http: HttpService,
  ) {}

  determineEmbeddingConfig(embededResponse: EmbedResponseDto): string | null {
    const frontEmbeddingId = embededResponse.frontEmbedding !== null;
    const backEmbeddingId = embededResponse.backEmbedding !== null;
    const textEmbeddingId = embededResponse.textEmbedding !== null;

    if (frontEmbeddingId && backEmbeddingId && textEmbeddingId) {
      return 'fbt';
    } else if (frontEmbeddingId && backEmbeddingId) {
      return 'fb';
    } else if (frontEmbeddingId && textEmbeddingId) {
      return 'ft';
    } else if (backEmbeddingId && textEmbeddingId) {
      return 'bt';
    } else if (frontEmbeddingId) {
      return 'f';
    } else if (backEmbeddingId) {
      return 'b';
    } else if (textEmbeddingId) {
      return 't';
    }
    return null; // No embeddings available
  }

  private async embedProduct(product: {
    id: number;
    metaData: string;
    productImages: { imageUrl: string }[];
  }): Promise<EmbedResponseDto> {
    const payload: EmbedRequestDto = {
      id: product.id,
      metaData: product.metaData,
      imageUrls: product.productImages.map((img) => img.imageUrl),
    };

    const { data } = await firstValueFrom(
      this.http.post<EmbedResponseDto>(
        `${this.baseUrl}/product-embed`,
        payload,
        {
          timeout: 60000,
        },
      ),
    );
    return data;
  }

  async generateTextEmbedding(query: string): Promise<number[]> {
    const payload: TextEmbedRequestDto = { text: query };

    const { data } = await firstValueFrom(
      this.http.post<TextEmbedResponseDto>(
        `${this.baseUrl}/text-embed`,
        payload,
        { timeout: 15_000 },
      ),
    );

    this.logger.debug(
      `ℹ️ generated text embedding - ${data.embedding.length} dims`,
    );
    return data.embedding;
  }

  async generateImageEmbedding(
    file: Express.Multer.File,
  ): Promise<ImageEmbedResponseDto> {
    // 1) wrap the raw buffer in multipart/form-data
    const form = new FormData();
    form.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    // 2) POST to FastAPI
    const { data } = await firstValueFrom(
      this.http.post<ImageEmbedResponseDto>(
        `${this.baseUrl}/image-embed`,
        form,
        {
          headers: form.getHeaders(), // axios sets boundary for us
          timeout: 15_000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        },
      ),
    );

    this.logger.debug(
      ` image classified as <${data.label}>  ${data.embedding.length} dims`,
    );
    return data;
  }

  async generateProductEmbeddingPerRetailer(
    retailer: string,
  ): Promise<EmbeddingBatchResult> {
    const startTime = Date.now();
    const dbBatchSize = 100;
    const concurrencyLimit = 30;
    let lastId = 0;

    let totalProcessed = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;
    const errors: Array<{ productId: number; error: string }> = [];
    let successfulResults: EmbedResponseDto[] = [];

    while (true) {
      const batch = await this.db.productItem.findMany({
        where: {
          retailer: retailer,
          embedding: null,
          id: { gt: lastId },
        },
        select: {
          id: true,
          metaData: true,
          productImages: { select: { imageUrl: true }, orderBy: { id: 'asc' } },
        },
        orderBy: { id: 'asc' },
        take: dbBatchSize,
      });

      if (batch.length === 0) break;

      this.logger.log(
        `🛠  Processing DB batch: ${batch.length} products (IDs ${batch[0].id} … ${
          batch[batch.length - 1].id
        })`,
      );

      const limit = pLimit(concurrencyLimit);
      const promises = batch.map((p) =>
        limit(() =>
          this.embedProduct(p).then(
            (resp) => {
              totalSuccessful++;
              return resp;
            },
            (err) => {
              this.logger.warn(
                `⚠️  Failed embedding for product ${p.id}: ${err.message || err}`,
              );
              totalFailed++;
              errors.push({
                productId: p.id,
                error: err.message || String(err),
              });
              return null;
            },
          ),
        ),
      );

      // Wait for all promises and filter out null results
      const batchResults = await Promise.all(promises);
      successfulResults = successfulResults.concat(
        batchResults.filter((result) => result !== null),
      );

      totalProcessed += batch.length;
      lastId = batch[batch.length - 1].id;
    }
    const embeddingResults = successfulResults;

    const timeElapsed = Date.now() - startTime;

    this.logger.log(
      `🏁 processPending complete. Total: ${totalProcessed}, Success: ${totalSuccessful}, Failed: ${totalFailed}`,
    );

    return {
      embeddingResults,
      totalProcessed,
      totalSuccessful,
      totalFailed,
      errors: errors.slice(0, 100),
      timeElapsed,
      lastProcessedId: lastId,
    };
  }
}
