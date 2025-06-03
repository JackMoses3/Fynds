import { Controller, Get, Query } from '@nestjs/common';
import { ProductItemService } from './product-item.service';

@Controller('product-item/options')
export class ProductItemOptionsController {
  constructor(private readonly svc: ProductItemService) {}

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
    return this.svc.getUniqueBrands({
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
    return this.svc.getUniqueRetailers({
      brand,
      category,
    });
  }

  @Get('categories')
  getCategories(
    @Query('brand') rawBrand?: string | string[],
    @Query('retailer') rawRetailer?: string | string[],
  ) {
    const brand = this.normalizeArrayParam(rawBrand);
    const retailer = this.normalizeArrayParam(rawRetailer);
    return this.svc.getUniqueCategories({
      brand,
      retailer,
    });
  }
}
