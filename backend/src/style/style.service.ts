/* eslint-disable */
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Style } from '../../generated/prisma';
import { ProductItemTransferDto } from 'src/product-item/dto/product-item.dto';
import { ProductItemService } from '../product-item/product-item.service';

@Injectable()
export class StyleService {
  constructor(
    private readonly db: DatabaseService,
    private readonly productItemService: ProductItemService,
  ) {}

  async findAll(): Promise<Style[]> {
    return this.db.style.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async getProductsByStyle(
    userId: number,
    styleId: number,
    limit: number = 50,
  ): Promise<ProductItemTransferDto[]> {
    return this.productItemService.getProductsWithFilters(
      userId,
      {
        styles: [styleId],
      },
      limit,
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
      ? { sex: this.mapClothingPreferenceToSex(user.clothingPreferences) }
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

  private mapClothingPreferenceToSex(clothingPreference: string): string {
    switch (clothingPreference.toLowerCase()) {
      case 'male':
        return 'Male';
      case 'female':
        return 'Female';
      case 'both':
      default:
        return '';
    }
  }
}
