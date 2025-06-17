import { IsOptional, IsArray, IsString, IsEnum } from 'class-validator';
import { FilterDto } from 'src/product-item/dto/filter.dto';
import { Gender } from '../dto/qdrant.dto';

export class QdrantFilterModel {
  @IsOptional()
  filter?: FilterDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  style?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(Gender, { each: true })
  gender?: Gender[];
}
