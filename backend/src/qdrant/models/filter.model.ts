import { IsOptional, IsArray, IsString, IsEnum } from 'class-validator';
import { FilterProductItemDto } from '../../product-item/dto/filter.dto';
import { Gender } from '../enums';

export class QdrantFilterModel {
  @IsOptional()
  filter?: FilterProductItemDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  style?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(Gender, { each: true })
  gender?: Gender[];
}
