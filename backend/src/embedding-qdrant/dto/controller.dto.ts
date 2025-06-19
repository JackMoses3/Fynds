import { FilterDto } from '../../product-item/dto/filter.dto';

export class TextSearchDto {
  query: string;
  filters: FilterDto;
}
