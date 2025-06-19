import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateViewingDto } from './dto/create-viewing.dto';

@Injectable()
export class ViewingService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Record a product viewing with metrics
   */
  async recordViewing(userId: number, dto: CreateViewingDto) {
    const { productId, scrollLength, scrollDepth } = dto;

    // Create viewing history record
    return this.db.viewingHistory.create({
      data: {
        userId,
        productItemId: productId,
        scrollLength,
        scrollDepth,
        viewedAt: new Date(),
        viewUntil: new Date(), // For now, set both times to now
      },
    });
  }

  /**
   * Get viewing history for a user
   */
  async getUserViewingHistory(userId: number) {
    return this.db.viewingHistory.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            retailer: true,
            price: true,
            productImages: {
              select: {
                id: true,
                imageUrl: true,
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { viewedAt: 'desc' },
    });
  }
}
