import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { RequestUser } from '../types';
import { ShoppingTrolleyService } from './shopping-trolley.service';
import { ShoppingTrolleyDto } from './dto/shopping-trolley.dto';
import { AddItemDto } from './dto/add-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Controller('shopping-trolley')
export class ShoppingTrolleyController {
  constructor(private readonly trolleyService: ShoppingTrolleyService) {}

  /** GET /shopping-trolley */
  @Get()
  async getTrolley(@Req() req: RequestUser): Promise<ShoppingTrolleyDto> {
    const raw = await this.trolleyService.getOrCreateForUser(req.user.sub);

    return {
      id: raw.id,
      items: raw.items.map((i) => ({
        // match TrolleyItemDto
        product: {
          id: i.product.id,
          name: i.product.name,
          brand: i.product.brand,
          retailer: i.product.retailer,
          price: i.product.price,
          url: i.product.url,
          images: i.product.productImages.map((img) => ({
            id: img.id,
            imageUrl: img.imageUrl,
          })),
        },
        quantity: i.quantity,
      })),
    };
  }

  /** POST /shopping-trolley/items */
  @Post('items')
  async addItem(@Req() req: RequestUser, @Body() dto: AddItemDto) {
    return this.trolleyService.addItem(
      req.user.sub, // Get the user ID from the request object
      dto.productId,
      dto.quantity ?? 1,
    );
  }

  /** PATCH /shopping-trolley/items/:productId */ //used to update quantity of an item in the trolley, likely not needed for now
  @Patch('items/:productId')
  async updateItem(
    @Req() req: RequestUser, // Get the user ID from the request object
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: UpdateItemDto,
  ) {
    return this.trolleyService.updateItemQuantity(
      req.user.sub, // Get the user ID from the request object
      productId,
      dto.quantity,
    );
  }

  /** DELETE /shopping-trolley/items/:productId */
  @Delete('items/:productId')
  async removeItem(
    @Req() req: RequestUser,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.trolleyService.removeItem(req.user.sub, productId);
  }
}
