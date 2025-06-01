import { ObjectType, Field, Int } from '@nestjs/graphql';
import { ProductImage } from './product-image.model';

@ObjectType()
export class ProductItem {
  @Field(() => Int)
  id: number;

  @Field()
  name: string;

  @Field()
  brand: string;

  @Field()
  price: number;

  @Field(() => [ProductImage])
  productImages: ProductImage[];
}
