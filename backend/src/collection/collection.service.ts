import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { DatabaseService } from '../database/database.service';
import { Prisma } from '../../generated/prisma';
import { ProductItemTransferDto } from '../product-item/dto/product-item.dto';
import { ProductScoreService } from '../recommendation/service/product-score.service';

@Injectable()
export class CollectionService {
  constructor(
    private readonly db: DatabaseService,
    private readonly productScoreService: ProductScoreService,
  ) {}

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

  async addProductToCollection(
    userId: number,
    collectionId: number,
    productId: number,
  ) {
    // Optionally, check that collection belongs to user
    const collection = await this.db.collection.findUnique({
      where: { id: collectionId },
    });
    if (!collection || collection.userId !== userId)
      throw new Error('Unauthorized');
    await this.productScoreService.addScore({
      userId,
      productItemId: productId,
      signals: { collectionItem: true },
    });
    return this.db.collectionItem.upsert({
      where: {
        collectionId_productItemId: { collectionId, productItemId: productId },
      },
      update: {},
      create: { collectionId, productItemId: productId },
    });
  }

  async removeProductFromCollection(
    userId: number,
    collectionId: number,
    productId: number,
  ) {
    // Optionally, check that collection belongs to user
    const collection = await this.db.collection.findUnique({
      where: { id: collectionId },
    });
    if (!collection || collection.userId !== userId)
      throw new Error('Unauthorized');
    return this.db.collectionItem.deleteMany({
      where: { collectionId, productItemId: productId },
    });
  }

  async getSavedProductIds(userId: number): Promise<number[]> {
    // Get all product IDs in any collection owned by user
    const items = await this.db.collectionItem.findMany({
      where: { collection: { userId } },
      select: { productItemId: true },
    });
    return items.map((i) => i.productItemId);
  }
}
