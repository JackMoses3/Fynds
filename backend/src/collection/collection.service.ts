import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { DatabaseService } from '../database/database.service';
import { Prisma } from '../../generated/prisma';
import { ProductItemTransferDto } from 'src/product-item/dto/product-item.dto';

@Injectable()
export class CollectionService {
  constructor(private readonly db: DatabaseService) {}

  async createNewCollection(userId: number, dto: CreateCollectionDto) {
    return this.db.collection.create({
      data: {
        name: dto.name,
        user: {
          connect: { id: userId },
        },
      },
      select: {
        id: true,
        name: true,
      },
    });
  }

  async findAll(userId: number) {
    return this.db.collection.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
      },
    });
  }

  async update(id: number, updateCollectionDto: Prisma.CollectionUpdateInput) {
    return this.db.collection.update({
      where: { id },
      data: updateCollectionDto,
    });
  }

  async remove(id: number) {
    return this.db.collection.delete({
      where: { id },
    });
  }

  /**
   * Get all products belonging to a given collection ID.
   * Returns an array of ProductItemTransferDto.
   */
  async getProductsByCollectionId(
    collectionId: number,
  ): Promise<ProductItemTransferDto[]> {
    const collection = await this.db.collectionItem.findMany({
      where: { collectionId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            brand: true,
            retailer: true,
            productImages: {
              orderBy: { id: 'asc' },
              select: {
                id: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });
    if (!collection) {
      throw new NotFoundException('Collection not found');
    }
    return collection.map((item) => ({
      id: item.product.id,
      name: item.product.name,
      brand: item.product.brand,
      retailer: item.product.retailer,
      price: item.product.price,
      url: item.product.productImages[0]?.imageUrl || '', // Assuming the first image URL is used as the product URL
      images: item.product.productImages.map((image) => ({
        id: image.id,
        imageUrl: image.imageUrl,
      })),
    }));
  }
  // Fetch the collection with its items and their products
}
