import { FilterDto } from 'src/product-item/dto/filter.dto';

export class TextSearchDto {
  query: string;
  filters: FilterDto;
}
