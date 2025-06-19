import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class LikeService {
  constructor(private readonly db: DatabaseService) {}

  async likeProduct(userId: number, productId: number) {
    return this.db.like.upsert({
      where: { userId_productItemId: { userId, productItemId: productId } },
      update: {},
      create: { userId, productItemId: productId },
    });
  }

  async unlikeProduct(userId: number, productId: number) {
    return this.db.like.deleteMany({
      where: { userId, productItemId: productId },
    });
  }

  async getLikedProductIds(userId: number): Promise<number[]> {
    const likes = await this.db.like.findMany({
      where: { userId },
      select: { productItemId: true },
    });
    return likes.map((l) => l.productItemId);
  }
}
