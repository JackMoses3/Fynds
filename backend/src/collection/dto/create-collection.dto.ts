import { ProductItemTransferDto } from "src/product-item/dto/product-item.dto";

export class CreateCollectionDto {
    name: string;
  }


export class getCollectionsDto {
    id: number;
    name: string;
    userId: number;
    productItem: ProductItemTransferDto[];
  }

export class getCollectionItemDto {
    id: number;
    product: ProductItemTransferDto;
  }