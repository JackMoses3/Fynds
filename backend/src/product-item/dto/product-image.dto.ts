export class ProductImageDto {
    id!: string;
    imageUrl!: string;
    productItemId!: string;     // <-- matches your Prisma field name
    frontFacing!: boolean | null;
    createdAt!: Date;
    updatedAt!: Date;
}

export class ProductImageTransferDto {
    id: number;
    imageUrl: string;
}