import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { Gender } from '../../qdrant/dto/qdrant.dto';

export class SearchDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  top_k?: number = 10;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  style?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  price_lte?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  category?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(Gender, { each: true })
  gender?: Gender[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  brand?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  retailer?: string[];
}

export class TextSearchDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  top_k?: number = 10;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  style?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  price_lte?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  category?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(Gender, { each: true })
  gender?: Gender[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  brand?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  retailer?: string[];
}

export class SimilarProductDto {
  @IsNumber()
  productId: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  top_k?: number = 10;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  style?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  price_lte?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  category?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(Gender, { each: true })
  gender?: Gender[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  brand?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  retailer?: string[];
}

export class ProcessProductDto {
  @IsNumber()
  productId: number;
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
