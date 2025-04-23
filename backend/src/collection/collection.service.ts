import { Injectable } from '@nestjs/common';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { DatabaseService } from '../database/database.service';
import { Prisma } from '@prisma/client';

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
        name: true,}
    });
  }

  async findAll(userId: number) {
    return this.db.collection.findMany({
      where: { userId },
      select: {
        id: true,
        name: true
      },});
  }

  async findOne(id: number) {
    return this.db.collection.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                retailer: true,
                productImages: true,
                // anything else you need — but NOT the embedding IDs
              }
            }
          },
        },
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
}
