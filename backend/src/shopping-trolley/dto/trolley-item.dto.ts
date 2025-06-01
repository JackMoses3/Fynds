import { ProductItemTransferDto } from '../../product-item/dto/product-item.dto';

//dto for single item in basket
export class TrolleyItemDto {
    product!: ProductItemTransferDto;
    quantity!: number;
}
