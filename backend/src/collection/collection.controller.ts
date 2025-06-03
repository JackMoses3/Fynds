import { Controller, Get, Post, Body, Param, Req } from '@nestjs/common';
import { CollectionService } from './collection.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { RequestUser } from '../types';

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
}
