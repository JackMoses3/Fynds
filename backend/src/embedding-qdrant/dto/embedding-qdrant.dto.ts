import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { QdrantFilterModel } from '../../qdrant/models/filter.model';

/**
 *
 *
 */

export class SearchDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  top_k?: number = 30;

  @IsOptional()
  qdrantFilter?: QdrantFilterModel;
}

// export class TextSearchDto {
//   @IsString()
//   text: string;

//   @IsOptional()
//   searchDto?: SearchDto;
// }

export class SimilarProductDto {
  @IsNumber()
  productId: number;

  @IsOptional()
  searchDto?: SearchDto;
}

export class BatchEmbedRetailerDto {
  retailer: string;
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(512)
  batchSize?: number;
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(128)
  concurrency?: number;
}

export interface EmbeddingQdrantBatchResult {
  embeddingResults: Array<{
    productId: number;
    hasF: boolean;
    hasB: boolean;
    hasT: boolean;
  }>;
  qdrantResults: {
    totalProcessed: number;
    totalSuccessful: number;
    totalFailed: number;
    errors: Array<{ productId: number; error: string; type: string }>;
  };
  timeElapsed: number;
}

export class ProcessProductDto {
  @IsNumber()
  productId: number;
}

export class ProcessProductResponseDto {
  success: boolean;
  message: string;
  productId?: number;
  embeddings?: {
    frontEmbedding?: number[];
    backEmbedding?: number[];
    textEmbedding?: number[];
  };
}
