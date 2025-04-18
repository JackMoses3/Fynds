// src/product-item/product-item.controller.ts

import {
  Body,
  Controller,
  Get,
  Post,
  NotFoundException,
  HttpCode,
} from '@nestjs/common';
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

  @Post('random-with-filters')
  @HttpCode(200)  // <— ensure 200 OK, not 201
  async getFilteredRandom(@Body() filters: any): Promise<ProductItem> {
    const product = await this.productItemService.getRandomProductWithFilters(filters);
    if (!product) {
      throw new NotFoundException('No product matched the filters');
    }
    return product;
  }
}
