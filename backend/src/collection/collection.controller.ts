import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  Delete,
} from '@nestjs/common';
import { CollectionService } from './collection.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { RequestUser } from '../types';
import { ParseIntPipe } from '@nestjs/common';

@Controller('collection')
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Post()
  create(@Req() req: RequestUser, @Body() dto: CreateCollectionDto) {
    return this.collectionService.createNewCollection(req.user.sub, dto);
  }

  @Get()
  findAll(@Req() req: RequestUser) {
    return this.collectionService.findAll(req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.collectionService.getProductsByCollectionId(+id);
  }

  // Add product to collection (save)
  @Post(':collectionId/add/:productId')
  async addProductToCollection(
    @Req() req: RequestUser,
    @Param('collectionId', ParseIntPipe) collectionId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.collectionService.addProductToCollection(
      req.user.sub,
      collectionId,
      productId,
    );
  }

  // Remove product from collection (unsave)
  @Delete(':collectionId/remove/:productId')
  async removeProductFromCollection(
    @Req() req: RequestUser,
    @Param('collectionId', ParseIntPipe) collectionId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.collectionService.removeProductFromCollection(
      req.user.sub,
      collectionId,
      productId,
    );
  }

  // Get all product IDs saved by user (across all collections)
  @Get('saved/ids')
  async getSavedProductIds(@Req() req: RequestUser) {
    return this.collectionService.getSavedProductIds(req.user.sub);
  }
}
