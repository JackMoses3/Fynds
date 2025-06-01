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
    UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ShoppingTrolleyService } from './shopping-trolley.service';
import { ShoppingTrolleyDto } from './dto/shopping-trolley.dto';
import { JwtAuthGuard } from '../auth/strategies/jwt/jwt-auth.guard';
import { AddItemDto } from './dto/add-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
@UseGuards(JwtAuthGuard)
@Controller('shopping-trolley')
export class ShoppingTrolleyController {
    constructor(private readonly trolleyService: ShoppingTrolleyService) { }

    /** GET /shopping-trolley */
    @Get()
    async getTrolley(@Req() req: Request): Promise<ShoppingTrolleyDto> {
        const userId = (req.user as any).id;
        const raw = await this.trolleyService.getOrCreateForUser(userId);

        return {
            id: raw.id,
            items: raw.items.map(i => ({
                // match TrolleyItemDto
                product: {
                    id: i.product.id,
                    name: i.product.name,
                    brand: i.product.brand,
                    retailer: i.product.retailer,
                    price: i.product.price,
                    url: i.product.url,
                    images: i.product.productImages.map(img => ({
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
    async addItem(
        @Req() req: Request,
        @Body() dto: AddItemDto,
    ) {
        const userId = (req.user as any).id;
        return this.trolleyService.addItem(userId, dto.productId, dto.quantity ?? 1);
    }

    /** PATCH /shopping-trolley/items/:productId */ //used to update quantity of an item in the trolley, likely not needed for now
    @Patch('items/:productId')
    async updateItem(
        @Req() req: Request, // Get the user ID from the request object
        @Param('productId', ParseIntPipe) productId: number,
        @Body() dto: UpdateItemDto,
    ) {
        const userId = (req.user as any).id;
        return this.trolleyService.updateItemQuantity(userId, productId, dto.quantity);
    }

    /** DELETE /shopping-trolley/items/:productId */
    @Delete('items/:productId')
    async removeItem(
        @Req() req: Request,
        @Param('productId', ParseIntPipe) productId: number,
    ) {
        const userId = (req.user as any).id;
        return this.trolleyService.removeItem(userId, productId);
    }
}