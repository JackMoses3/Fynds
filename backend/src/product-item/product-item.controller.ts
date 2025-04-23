import {
  Body,
  Controller,
  Get,
  Post,
  NotFoundException,
  HttpCode,
} from '@nestjs/common';
import { ProductItemService } from './product-item.service';
import type { ProductItem, ProductImage } from '@prisma/client';
import { ProductItemDto, ProductItemTransferDto } from './dto/product-item.dto';
import { ProductImageDto } from './dto/product-image.dto';
import { FilterProductItemDto } from './dto/filter-product-item.dto';

@Controller('product-item')
export class ProductItemController {
  constructor(private readonly productItemService: ProductItemService) { }

  @Post('brands')
  getBrands(@Body() body: {category: string[]; retailer: string[];} ): Promise<string[]> {
    return this.productItemService.getUniqueBrands(body);
  }

  @Post('retailers')
  getRetailers(@Body() body: {brand: string[]; category: string[];} ): Promise<string[]> {
    return this.productItemService.getUniqueRetailers(body);
  }

  @Post('categories')
  getCategories(@Body() body: {brand: string[]; retailer: string[];} ): Promise<string[]> {
    return this.productItemService.getUniqueCategories(body);
  }

  @Get()
  getRandom(): Promise<ProductItemTransferDto[]> {
    return this.productItemService.getRandomProducts();
}

  @Post('filtered')
  async getFilteredProducts(@Body() filters: FilterProductItemDto): Promise<ProductItemTransferDto[] | null> {
    return this.productItemService.getFilteredProducts(filters);
  }
}