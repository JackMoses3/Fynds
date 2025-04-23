import { IsOptional, IsArray, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterProductItemDto {
    @IsOptional()
    @IsArray()
    @Type(() => String)
    brands?: string[];

    @IsOptional()
    @IsArray()
    @Type(() => String)
    categories?: string[];

    @IsOptional()
    @IsArray()
    @Type(() => String)
    retailers?: string[];

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

