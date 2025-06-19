import { IsInt, IsOptional, Min } from 'class-validator';

export class CreateViewingDto {
  @IsInt()
  productId: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  scrollLength?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  scrollDepth?: number;
}
