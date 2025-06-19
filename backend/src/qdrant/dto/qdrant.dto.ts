import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  Max,
  IsEnum,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { QdrantFilterModel } from '../models/filter.model';

export enum CollectionType {
  TEXT_EMBEDDINGS = 'TEXT_EMBEDDINGS',
  IMAGE_FRONT_EMBEDDINGS = 'IMAGE_FRONT_EMBEDDINGS',
  IMAGE_BACK_EMBEDDINGS = 'IMAGE_BACK_EMBEDDINGS',
  USER_EMBEDDINGS = 'USER_EMBEDDINGS',
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  UNISEX = 'unisex',
}

export class InsertVectorDto {
  @IsEnum(CollectionType)
  collection: CollectionType;

  @IsNumber()
  product_id: number;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  style?: string[];

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

  @IsArray()
  @ArrayMinSize(512)
  @ArrayMaxSize(512)
  @IsNumber({}, { each: true })
  vector: number[];
}

// Once the vector is generated for embedding-qdrant
export class SearchVectorDto {
  @IsEnum(CollectionType)
  collection: CollectionType;

  @IsArray()
  @ArrayMinSize(512)
  @ArrayMaxSize(512)
  @IsNumber({}, { each: true })
  vector: number[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  top_k?: number = 10;

  @IsOptional()
  qdrantFilter?: QdrantFilterModel;
}

export class LikeProductDto {
  @IsEnum(CollectionType)
  collection: CollectionType;

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
  qdrantFilter?: QdrantFilterModel;
}

export class DeleteVectorDto {
  @IsEnum(CollectionType)
  collection: CollectionType;

  @IsNumber()
  productId: number;
}
