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
