/*eslint-disable */
import {
  Body,
  Controller,
  Get,
  Post,
  NotFoundException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/strategies/jwt/jwt-auth.guard';
import { ProductItemService } from './product-item.service';
import { ProductScoreService } from '../recommendation/service/product-score.service';
import { ProductItemTransferDto } from './dto/product-item.dto';
import { Filters } from './dto/filter.dto';
import { RequestUser } from '../types';

class BatchRequestDto {
  ids!: number[];
}

@UseGuards(JwtAuthGuard)
@Controller('product-item')
export class ProductItemController {
  constructor(
    private readonly productItemService: ProductItemService,
    private readonly productScoreService: ProductScoreService,
  ) {}

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

  /** POST /product-item/bulk
   * Used for bulk fetching products by IDs (for like collections)
   */
  @Post('bulk')
  async getBulk(@Body('ids') ids: number[]) {
    return this.productItemService.findManyByIds(ids);
  }

  /** GET /product-item/recommended */
  @Get('recommended')
  async getRecommendedProducts(@Req() req: RequestUser) {
    // Here, req.user should contain { sub: number, ... }
    const userId = req.user.sub; // Make sure 'sub' is defined in your JWT payload
    if (!userId) {
      throw new Error('JWT is missing a valid user ID (sub)');
    }

    // Pass the valid userId to your service
    return this.productItemService.getRecommendedProducts(userId);
  }

  /** POST /product-item/add-score */
  @Post('add-score')
  async addScore(@Body() body: any) {
    const { userId, productItemId, signals } = body;
    return this.productScoreService.addScore({
      userId,
      productItemId,
      signals,
    });
  }
}
