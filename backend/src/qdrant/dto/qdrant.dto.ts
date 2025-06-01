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

export enum CollectionType {
  TEXT_EMBEDDINGS = 'text_embeddings',
  IMAGE_FRONT_EMBEDDINGS = 'image_front_embeddings',
  IMAGE_BACK_EMBEDDINGS = 'image_back_embeddings',
  USER_EMBEDDINGS = 'user_embeddings',
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

export class SearchProductDto {
  @IsEnum(CollectionType)
  collection: CollectionType;

  @IsNumber()
  product_id: number;

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

export class DeleteVectorDto {
  @IsEnum(CollectionType)
  collection: CollectionType;

  @IsNumber()
  product_id: number;
}
