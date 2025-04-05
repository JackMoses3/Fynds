import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';

interface CreateProductInput extends Omit<Prisma.ProductItemCreateInput, 'productImages'> {
  imageUrls: string[];
}

@Injectable()
export class ProductItemService {
  constructor(private readonly db: DatabaseService) {}

  async createProductWithImages(data: CreateProductInput) {
    const { imageUrls, ...productData } = data;

    return this.db.productItem.create({
      data: {
        ...productData,
        productImages: {
          create: imageUrls.map((url) => ({
            imageUrl: url,
          })),
        },
      },
    });
  }
}
