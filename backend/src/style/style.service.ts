/* eslint-disable */
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Style } from '../../generated/prisma';
import { ProductItemTransferDto } from 'src/product-item/dto/product-item.dto';

@Injectable()
export class StyleService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(): Promise<Style[]> {
    return this.db.style.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async getProductsByStyle(
    userId: number,
    styleId: number,
    limit: number = 50,
    offset: number = 0,
  ): Promise<ProductItemTransferDto[]> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { clothingPreferences: true },
    });

    const genderFilter = user?.clothingPreferences
      ? { gender: user.clothingPreferences }
      : {};

    const products = await this.db.productItem.findMany({
      where: {
        productStyles: {
          some: { styleId: styleId },
        },
        ...(user?.clothingPreferences
          ? { clothingPreferences: user.clothingPreferences }
          : {}),
      },
      include: {
        productImages: {
          orderBy: { id: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Map to ProductItemTransferDto format
    return products.map(
      (p): ProductItemTransferDto => ({
        id: p.id,
        name: p.name || '',
        brand: p.brand || '',
        retailer: p.retailer || '',
        price: p.price || 0,
        url: p.url || '',
        images: p.productImages.map((img) => ({
          id: img.id,
          imageUrl: img.imageUrl,
        })),
      }),
    );
  }

  async getProductCountByStyle(
    userId: number,
    styleId: number,
  ): Promise<number> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { clothingPreferences: true },
    });

    const genderFilter = user?.clothingPreferences
      ? { gender: user.clothingPreferences }
      : {};

    return this.db.productItem.count({
      where: {
        productStyles: {
          some: { styleId: styleId },
        },
        ...genderFilter,
      },
    });
  }
}
