// src/embedding/embedding.service.ts
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

// 1) Import your PrismaService class (instead of Prisma, ProductItem, etc.)
import { PrismaService } from '../../prisma/prisma.service';

// 2) Import the DTOs
import { EmbedRequestDTO } from './dto/embeded-request.dto';
import { EmbedResponseDTO } from './dto/embeded-response.dto';

// 3) Import the constant (make sure constants.ts actually does `export const ML_BASE_URL = '…';`)
import { ML_BASE_URL } from './constants';

@Injectable()
export class EmbeddingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
  ) {}

  /**
   * Fetch the next product with no embeddings,
   * send it to the ML server, and then persist the returned IDs.
   */
  async generateForNext(): Promise<void> {
    // ---------------------------------------------------------
    //  A) Fetch one ProductItem from the database
    // ---------------------------------------------------------
    const product = await this.prisma.productItem.findFirst({
      where: {
        frontEmbeddingId: null,
        backEmbeddingId: null,
        textEmbeddingId: null,
      },
      include: {
        productImages: true,
      },
    });
    if (!product) {
      // nothing left to embed
      return;
    }

    // ---------------------------------------------------------
    //  B) Build the payload (type-safe)
    // ---------------------------------------------------------
    const payload: EmbedRequestDTO = {
      productId: product.id,
      name: product.name,
      images: product.productImages.map(
        (img: { id: number; imageUrl: string }) => ({
          id: img.id,
          url: img.imageUrl,
        }),
      ),
    };

    // ---------------------------------------------------------
    //  C) Call the external ML service (Axios via HttpService)
    // ---------------------------------------------------------
    // Use firstValueFrom(...) instead of .toPromise(), which Nest/axios deprecates.
    const axiosResponse = await firstValueFrom(
      this.http.post<EmbedResponseDTO>(`${ML_BASE_URL}/embed`, payload),
    );

    // At this point, `axiosResponse` is guaranteed to be an AxiosResponse<EmbedResponseDTO>.
    // Its “.data” property is your EmbedResponseDTO.
    const data: EmbedResponseDTO = axiosResponse.data;

    // ---------------------------------------------------------
    //  D) Upsert into your local DB / embedding table
    // ---------------------------------------------------------
    // (You’ll need an `Embedding` table in Prisma with something like:
    //   model Embedding {
    //     id    Int      @id
    //     front Float8[] // 512 floats
    //     back  Float8[] // 512 floats
    //     text  Float8[] // 512 floats
    //   }
    // )
    //await this.prisma.$transaction([
    // 1) update the ProductItem row with the new front/back/text IDs
    //  this.prisma.productItem.update({
    //    where: { id: product.id },
    //    data: {
    //      frontEmbeddingId: data.frontEmbedding ? product.id * 2 - 1 : null,
    //      backEmbeddingId: data.backEmbedding ? product.id * 2 : null,
    //      textEmbeddingId: product.id,
    //    },
    //  }),

    // 2) upsert the raw 512‐float vectors into an Embedding table
    //  this.prisma.embedding.upsert({
    //    where: { id: product.id },
    //    create: {
    //      id: product.id,
    //      front: data.frontEmbedding,
    //      back: data.backEmbedding,
    //      text: data.textEmbedding,
    //    },
    //    update: {
    //      front: data.frontEmbedding,
    //      back: data.backEmbedding,
    //      text: data.textEmbedding,
    //    },
    //  }),
    //]);
  }
}
