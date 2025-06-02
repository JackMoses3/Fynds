import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import pLimit from 'p-limit'; // “npm install p-limit” or yarn add p-limit
import { EmbedRequestDto } from './dto/embeded-request.dto';
import { EmbedResponseDto } from './dto/embeded-response.dto';
import { firstValueFrom } from 'rxjs';
export interface TextEmbedRequestDto {
  text: string;
}
export interface TextEmbedResponseDto {
  embedding: number[];
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly baseUrl =
    process.env.EMBEDDING_SERVICE_URL ?? 'http://localhost:8000';

  constructor(
    private prisma: PrismaService,
    private http: HttpService,
  ) {}

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
      `ℹ️ generated text embedding – ${data.embedding.length} dims`,
    );
    return data.embedding;
  }

  async generateProductEmbedding(): Promise<EmbedResponseDto[]> {
    const dbBatchSize = 100;
    const concurrencyLimit = 30;
    let lastId = 0;
    const allResults: EmbedResponseDto[] = [];

    while (true) {
      const batch = await this.prisma.productItem.findMany({
        where: {
          frontEmbeddingId: null,
          backEmbeddingId: null,
          textEmbeddingId: null,
          id: { gt: lastId },
        },
        select: {
          id: true,
          metaData: true,
          productImages: { select: { imageUrl: true } },
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

      // p-limit gives you a “pool” of size `concurrencyLimit`
      const limit = pLimit(concurrencyLimit);
      const promises = batch.map((p) =>
        limit(() =>
          this.embedProduct(p).then(
            (resp) => {
              this.logger.log(`✅ Embedded product ${resp.productId}`);
              allResults.push(resp);
            },
            (err) => {
              this.logger.warn(
                `⚠️  Failed embedding for product ${p.id}: ${err.message || err}`,
              );
            },
          ),
        ),
      );

      // Wait until all 100 in this DB batch have been issued & settled
      await Promise.all(promises);
      lastId = batch[batch.length - 1].id;
    }

    this.logger.log(
      `🏁 processPending complete. Total embedded: ${allResults.length}`,
    );
    return allResults;
  }
}
