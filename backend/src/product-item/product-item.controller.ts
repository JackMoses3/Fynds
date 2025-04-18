import { Body, Controller, Get, Post } from '@nestjs/common';
import { ProductItemService } from './product-item.service';
import { ProductItem } from '@prisma/client';

@Controller('product-item')
export class ProductItemController {
  constructor(private readonly productItemService: ProductItemService) { }

  @Get('random')
  async getRandomProduct(): Promise<ProductItem> {
    return this.productItemService.getRandomProduct();
  }

  @Get('options/categories')
  getCategories(): Promise<string[]> {
    return this.productItemService.getUniqueCategories();
  }

  @Get('options/brands')
  getBrands(): Promise<string[]> {
    return this.productItemService.getUniqueBrands();
  }

  @Get('options/retailers')
  getRetailers(): Promise<string[]> {
    return this.productItemService.getUniqueRetailers();
  }

  // ✅ NEW: Post route for filters
  @Post('random-with-filters')
  async getFilteredRandom(@Body() filters: any): Promise<ProductItem | null> {
    return this.productItemService.getRandomProductWithFilters(filters);
  }
}
