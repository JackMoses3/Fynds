import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  ShoppingTrolley,
  TrolleyItem,
  ProductItem,
  ProductImage,
} from '../../generated/prisma'; // Adjust the import path based on your project structure

@Injectable()
export class ShoppingTrolleyService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Get (or create) the user's single ShoppingTrolley.
   * We explicitly annotate the return type to include:
   *   - ShoppingTrolley fields,
   *   - items: an array of (TrolleyItem & { product: ProductItem & { productImages: ProductImage[] } })
   */
  async getOrCreateForUser(userId: number): Promise<
    ShoppingTrolley & {
      items: Array<
        TrolleyItem & {
          product: ProductItem & { productImages: ProductImage[] };
        }
      >;
    }
  > {
    // Find the user's shopping trolley, or create a new one if it doesn't exist
    let trolley = await this.db.shoppingTrolley.findFirst({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                productImages: true,
              },
            },
          },
        },
      },
    });

    if (!trolley) {
      trolley = await this.db.shoppingTrolley.create({
        data: { userId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  productImages: true,
                },
              },
            },
          },
        },
      });
    }

    return trolley; //return the trolley with its items
  }

  /** Add a product (or bump quantity if already in basket) */
  async addItem(
    userId: number,
    productId: number,
    qty = 1,
  ): Promise<TrolleyItem> {
    const trolley = await this.getOrCreateForUser(userId); // Get or create the user's shopping trolley
    const existing = await this.db.trolleyItem.findFirst({
      where: {
        shoppingTrolleyId: trolley.id,
        productItemId: productId,
      },
    });
    if (existing) {
      //if the item already exists in the trolley, deletes it
      return this.db.trolleyItem.delete({
        where: { id: existing.id },
      });
    }

    return this.db.trolleyItem.create({
      data: {
        shoppingTrolleyId: trolley.id,
        productItemId: productId,
        quantity: qty,
      },
    });
  }

  /** Update the quantity of a basket item */
  async updateItemQuantity(
    userId: number,
    productId: number,
    quantity: number,
  ): Promise<number> {
    const trolley = await this.getOrCreateForUser(userId);
    const result = await this.db.trolleyItem.updateMany({
      where: {
        shoppingTrolleyId: trolley.id,
        productItemId: productId,
      },
      data: { quantity },
    });
    return result.count;
  }

  /** Remove an item from the basket entirely */
  async removeItem(userId: number, productId: number): Promise<number> {
    const trolley = await this.getOrCreateForUser(userId);
    const result = await this.db.trolleyItem.deleteMany({
      where: {
        shoppingTrolleyId: trolley.id,
        productItemId: productId,
      },
    });
    return result.count;
  }
}
