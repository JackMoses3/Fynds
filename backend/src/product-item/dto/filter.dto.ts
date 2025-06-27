import { IsOptional } from 'class-validator';

export class Filters {
  // Support both singular and plural forms

  @IsOptional()
  sex?: string;

  @IsOptional()
  brands?: string[];

  @IsOptional()
  retailers?: string[];

  @IsOptional()
  categories?: string[];

  @IsOptional()
  minPrice?: number;

  @IsOptional()
  maxPrice?: number;

  @IsOptional()
  styles?: number[];
}
