/* eslint-disable */
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import FormData from 'form-data';
import pLimit from 'p-limit';

import { DatabaseService } from '../database/database.service';
import { EmbedRequestDto } from './dto/embeded-request.dto';
import { EmbedResponseDto } from './dto/embeded-response.dto';

interface TextEmbedRequestDto {
  text: string;
}
interface TextEmbedResponseDto {
  embedding: number[];
}

export interface ImageEmbedResponseDto {
  label: 'front' | 'back';
  embedding: number[];
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly baseUrl = `${process.env.ML_URL}/api/v1/embedding`;

  constructor(
    private readonly db: DatabaseService,
    private readonly http: HttpService,
  ) {}

  /* ──────────────────────────────────────────────────────────
     Public helpers
     ───────────────────────────────────────────────────────── */

  determineEmbeddingConfig(e: EmbedResponseDto): string | null {
    const f = !!e.frontEmbedding;
    const b = !!e.backEmbedding;
    const t = !!e.textEmbedding;
    return f && b && t
      ? 'fbt'
      : f && b
        ? 'fb'
        : f && t
          ? 'ft'
          : b && t
            ? 'bt'
            : f
              ? 'f'
              : b
                ? 'b'
                : t
                  ? 't'
                  : null;
  }

  /**
   * Call the ML service to embed a **whole product** (text + images).
   */
  async embedProduct(product: {
    id: number;
    metaData: string;
    productImages: { imageUrl: string }[];
  }): Promise<EmbedResponseDto> {
    const payload: EmbedRequestDto = {
      id: product.id,
      metaData: product.metaData,
      imageUrls: product.productImages.map((i) => i.imageUrl),
    };

    const { data } = await firstValueFrom(
      this.http.post<EmbedResponseDto>(
        `${this.baseUrl}/product-embed`,
        payload,
        {
          timeout: 60_000,
        },
      ),
    );

    return data;
  }

  /** Single-sentence / keywords → vector */
  async generateTextEmbedding(text: string): Promise<number[]> {
    const { data } = await firstValueFrom(
      this.http.post<TextEmbedResponseDto>(
        `${this.baseUrl}/text-embed`,
        { text },
        { timeout: 15_000 },
      ),
    );
    return data.embedding;
  }

  /**
   * Multipart upload → ML service → { label, embedding }
   * Keeps the controller thin by delegating classification + vectorisation.
   */
  async generateImageEmbedding(
    file: Express.Multer.File,
  ): Promise<ImageEmbedResponseDto> {
    const form = new FormData();
    form.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const { data } = await firstValueFrom(
      this.http.post<ImageEmbedResponseDto>(
        `${this.baseUrl}/image-embed`,
        form,
        {
          headers: form.getHeaders(),
          timeout: 15_000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        },
      ),
    );

    return data;
  }
}
