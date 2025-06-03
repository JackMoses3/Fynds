import { Resolver, Query, Args } from '@nestjs/graphql';
import { ProductItemService } from './product-item.service';
import { ProductItem } from './models/product-item.model';

@Resolver(() => ProductItem)
export class ProductItemResolver {
  constructor(private readonly productItemService: ProductItemService) {}

  @Query(() => ProductItem, { name: 'productItem' })
  async getProductItem(@Args('id') id: number) {
    return this.productItemService.findById(id);
  }
}
