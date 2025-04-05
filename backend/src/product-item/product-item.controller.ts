import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ProductItemService } from './product-item.service';

@Controller('product-item')
export class ProductItemController {
  constructor(private readonly productItemService: ProductItemService) {}

}
