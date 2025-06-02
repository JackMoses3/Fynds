import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class ProductImage {
  @Field(() => Int)
  id: number;

  @Field()
  imageUrl: string;

  @Field()
  frontFacing: boolean;

  @Field(() => Int)
  productItemId: number; // this links the image to a product
}
