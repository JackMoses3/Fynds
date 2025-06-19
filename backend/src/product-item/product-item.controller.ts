import { Body, Controller, Get, Post, NotFoundException } from '@nestjs/common';
import { ProductItemService } from './product-item.service';
import { ProductItemTransferDto } from './dto/product-item.dto';
import { FilterProductItemDto } from './dto/filter.dto';

class BatchRequestDto {
  ids!: number[];
}

@Controller('product-item')
export class ProductItemController {
  constructor(private readonly productItemService: ProductItemService) {}

  /** POST /product-item/brands */
  @Post('brands')
  getBrands(
    @Body() body: { category?: string[]; retailer?: string[] },
  ): Promise<string[]> {
    return this.productItemService.getUniqueBrands(body);
  }

  /** POST /product-item/retailers */
  @Post('retailers')
  getRetailers(
    @Body() body: { brand?: string[]; category?: string[] },
  ): Promise<string[]> {
    return this.productItemService.getUniqueRetailers(body);
  }

  /** POST /product-item/categories */
  @Post('categories')
  getCategories(
    @Body() body: { brand?: string[]; retailer?: string[] },
  ): Promise<string[]> {
    return this.productItemService.getUniqueCategories(body);
  }

  /** GET /product-item */
  @Get()
  getRandom(): Promise<ProductItemTransferDto[]> {
    return this.productItemService.getRandomProducts();
  }

  /** POST /product-item/filtered */
  @Post('filtered')
  getFilteredProducts(
    @Body() filters: FilterProductItemDto,
  ): Promise<ProductItemTransferDto[] | null> {
    return this.productItemService.getFilteredProductItems(filters);
  }

  /** POST /product-item/batch */
  @Post('batch')
  async getBatch(
    @Body() batchReq: BatchRequestDto,
  ): Promise<ProductItemTransferDto[]> {
    const { ids } = batchReq;
    const raws = await Promise.all(
      ids.map((id) => this.productItemService.findById(id)),
    ); // Fetch all products in parallel [id, name, retailer ...]
    const found = raws.filter((p): p is Exclude<typeof p, null> => p !== null);

    if (!found.length) {
      throw new NotFoundException(
        `No products found for IDs: [${ids.join(', ')}]`,
      );
    }

    return found.map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      retailer: p.retailer,
      price: p.price,
      url: p.url,
      images: p.productImages.map((img) => ({
        id: img.id,
        imageUrl: img.imageUrl,
      })),
    }));
  }
}
