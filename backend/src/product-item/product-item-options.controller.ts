import { Controller, Get, Query } from '@nestjs/common';
import { ProductItemService } from './product-item.service';

@Controller('product-item/options')
export class ProductItemOptionsController {
  constructor(private readonly productItemService: ProductItemService) {}

  private normalizeArrayParam(param?: string | string[]): string[] | undefined {
    if (!param) return undefined;
    if (Array.isArray(param)) return param;
    return [param];
  }

  @Get('brands')
  getBrands(
    @Query('retailer') rawRetailer?: string | string[],
    @Query('category') rawCategory?: string | string[],
  ) {
    const retailer = this.normalizeArrayParam(rawRetailer);
    const category = this.normalizeArrayParam(rawCategory);
    return this.productItemService.getUniqueBrands({
      retailer,
      category,
    });
  }

  @Get('retailers')
  getRetailers(
    @Query('brand') rawBrand?: string | string[],
    @Query('category') rawCategory?: string | string[],
  ) {
    const brand = this.normalizeArrayParam(rawBrand);
    const category = this.normalizeArrayParam(rawCategory);
    return this.productItemService.getUniqueRetailers({
      brand,
      category,
    });
  }
}
