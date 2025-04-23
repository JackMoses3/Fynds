import { ProductImageDto, ProductImageTransferDto } from './product-image.dto';

export class ProductItemDto {
    id!: string;
    sex!: string;
    name!: string;
    url!: string;
    metaData!: string;
    retailer!: string;
    price!: number;
    frontEmbeddingId!: string | null;
    backEmbeddingId!: string | null;
    textEmbeddingId!: string | null;
    brand!: string;
    category!: string | null;
    subCategory!: string | null;
    createdAt!: Date;
    updatedAt!: Date;

    // <-- notice the capital “I” here
    productImages!: ProductImageDto[];
}

export class ProductItemTransferDto {
    id: number;
    name: string;
    brand: string;
    retailer: string;
    price: number;
    images: ProductImageTransferDto[];
}