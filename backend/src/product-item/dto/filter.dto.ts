import { IsOptional, IsArray, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

<<<<<<< HEAD:backend/src/product-item/dto/filter-product-item.dto.ts
export class FilterProductItemDto {
  // Support both singular and plural forms
=======
export class FilterDto {
>>>>>>> b0d3baf (fixing up filter):backend/src/product-item/dto/filter.dto.ts
  @IsOptional()
  @IsArray()
  @Type(() => String)
  brands?: string[];

  @IsOptional()
  @IsArray()
  @Type(() => String)
  brand?: string[];

  @IsOptional()
  @IsArray()
  @Type(() => String)
  retailers?: string[];

  @IsOptional()
  @IsArray()
  @Type(() => String)
  retailer?: string[];

  @IsOptional()
  @IsArray()
  @Type(() => String)
  categories?: string[];

  @IsOptional()
  @IsArray()
  @Type(() => String)
  category?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;
}
