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
import { ProductItemDto } from './dto/product-item.dto';
import { ProductImageDto } from './dto/product-image.dto';

@Controller('product-item')
export class ProductItemController {
  constructor(private readonly productItemService: ProductItemService) { }

  // ————————————————————————————————
  // GET /api/product-item/random
  // ————————————————————————————————
  @Get('random')
  async getRandomProduct(): Promise<ProductItemDto> {
    const raw = await this.productItemService.getRandomProduct();
    if (!raw) {
      throw new NotFoundException('No products in database');
    }
    return this.toDto(raw);
  }

  // ————————————————————————————————
  // GET OPTIONS …
  // ————————————————————————————————
  //@Get('options/categories')
  //getCategories(): Promise<string[]> {
  //  return this.productItemService.getUniqueCategories();
  //}
  //@Get('options/brands')
  //getBrands(): Promise<string[]> {
  //  return this.productItemService.getUniqueBrands();
  //}
  //@Get('options/retailers')
  //getRetailers(): Promise<string[]> {
  //  return this.productItemService.getUniqueRetailers();
  //}

  // ————————————————————————————————
  // POST /api/product-item/random-with-filters
  // ————————————————————————————————
  @Post('random-with-filters')
  @HttpCode(200)
  async getFilteredRandom(@Body() filters: any): Promise<ProductItemDto> {
    const raw = await this.productItemService.getRandomProductWithFilters(filters);
    if (!raw) {
      throw new NotFoundException('No product matched the filters');
    }
    return this.toDto(raw);
  }

  /**
   * Shared BigInt → string serializer for both endpoints
   */
  private toDto(
    product: ProductItem & { productImages: ProductImage[] }
  ): ProductItemDto {
    const dto = new ProductItemDto();

    dto.id = product.id.toString();
    dto.sex = product.sex;
    dto.name = product.name;
    dto.url = product.url;
    dto.metaData = product.metaData;
    dto.retailer = product.retailer;
    dto.price = product.price;
    dto.frontEmbeddingId = product.frontEmbeddingId?.toString() ?? null;
    dto.backEmbeddingId = product.backEmbeddingId?.toString() ?? null;
    dto.textEmbeddingId = product.textEmbeddingId?.toString() ?? null;
    dto.brand = product.brand;
    dto.category = product.category;
    dto.subCategory = product.subCategory;
    dto.createdAt = product.createdAt;
    dto.updatedAt = product.updatedAt;

    dto.productImages = product.productImages.map(img => {
      const imgDto = new ProductImageDto();
      imgDto.id = img.id.toString();
      imgDto.imageUrl = img.imageUrl;
      imgDto.productItemId = img.productItemId.toString();
      imgDto.frontFacing = img.frontFacing;
      imgDto.createdAt = img.createdAt;
      imgDto.updatedAt = img.updatedAt;
      return imgDto;
    });

    return dto;
  }
}