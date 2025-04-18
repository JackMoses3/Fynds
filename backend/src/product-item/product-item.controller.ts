import { Body, Controller, Get, Post } from '@nestjs/common';
import { ProductItemService } from './product-item.service';
import { ProductItem } from '@prisma/client';

@Controller('product-item')
export class ProductItemController {
  constructor(private readonly productItemService: ProductItemService) { }

  //gets a random product from DB
  @Get('random')
  async getRandomProduct(): Promise<ProductItem> {
    return this.productItemService.getRandomProduct();
  }

  //gets a list of unique categories from DB
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

  //post request to get a random product from DB with filtered criteria
  @Post('random-with-filters')
  async getFilteredRandom(@Body() filters: any): Promise<ProductItem | null> {
    return this.productItemService.getRandomProductWithFilters(filters);
  }
}
