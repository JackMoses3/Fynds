import { Injectable } from '@nestjs/common';
import { Prisma, ProductItem } from '@prisma/client';
import { DatabaseService } from '../database/database.service';

interface CreateProductInput extends Omit<Prisma.ProductItemCreateInput, 'productImages'> {
  imageUrls: string[];
}

@Injectable()
export class ProductItemService {
  constructor(private readonly db: DatabaseService) { }

  //create a product with its associated images
  async createProductWithImages(data: CreateProductInput) {
    const { imageUrls, ...productData } = data;

    return this.db.productItem.create({
      data: {
        ...productData,
        productImages: {
          create: imageUrls.map((url) => ({
            imageUrl: url, // Creates product images using the provided image URLs
          })),
        },
      },
    });
  }

  // Fetches a product by its ID, including its associated images
  async findById(id: number) {
    return this.db.productItem.findUnique({
      where: { id },
      include: { productImages: true },
    });
  }

  // Fetches a random product from the database
  async getRandomProduct() {
    const count = await this.db.productItem.count();
    const randomIndex = Math.floor(Math.random() * count);
    const [randomProduct] = await this.db.productItem.findMany({
      skip: randomIndex,
      take: 1,
      include: {
        productImages: true,
      },
    });

    return randomProduct;
  }

  // Fetches unique categories from the products
  async getUniqueCategories(): Promise<string[]> {
    const categories = await this.db.productItem.findMany({
      where: { category: { not: '' } },
      distinct: ['category'],
      select: { category: true },
    });
    return categories.map(c => c.category!).filter(Boolean);
  }

  async getUniqueBrands(): Promise<string[]> {
    const brands = await this.db.productItem.findMany({
      where: { brand: { not: '' } },
      distinct: ['brand'],
      select: { brand: true },
    });
    return brands.map(b => b.brand!).filter(Boolean);
  }

  async getUniqueRetailers(): Promise<string[]> {
    const retailers = await this.db.productItem.findMany({
      where: { retailer: { not: '' } },
      distinct: ['retailer'],
      select: { retailer: true },
    });
    return retailers.map(r => r.retailer!).filter(Boolean);
  }

  // Gets a random product that alligns with filters
  async getRandomProductWithFilters(filters: any): Promise<ProductItem | null> {
    const where: any = {};

    //if filter length for below is > 0, then a filter has occured. So apply it
    if (filters.brand?.length > 0) {
      where.brand = { in: filters.brand };
    }

    if (filters.retailer?.length > 0) {
      where.retailer = { in: filters.retailer };
    }

    if (filters.category?.length > 0) {
      where.category = { in: filters.category }; // ✅ Add this!
    }

    if (typeof filters.minPrice === 'number') {
      where.price = { ...(where.price || {}), gte: filters.minPrice };
    }

    if (typeof filters.maxPrice === 'number') {
      where.price = { ...(where.price || {}), lte: filters.maxPrice };
    }

    const count = await this.db.productItem.count({ where });
    if (count === 0) return null;

    const randomIndex = Math.floor(Math.random() * count);
    const [randomProduct] = await this.db.productItem.findMany({
      skip: randomIndex,
      take: 1,
      where,
      include: { productImages: true },
    });

    return randomProduct;
  }



}
