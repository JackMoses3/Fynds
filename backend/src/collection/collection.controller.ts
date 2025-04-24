import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { CollectionService } from './collection.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/strategies/jwt/jwt-auth.guard';

@Controller('collection')
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() req: RequestUser,
  @Body() dto: CreateCollectionDto) {
    try {
      const user = req as any;
      return this.collectionService.createNewCollection(user.user.id, dto);
    } catch (error) {
      console.error('❌ Error in create:', error);
      throw error;
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Req() req: RequestUser) {
    return this.collectionService.findAll(req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.collectionService.getProductsByCollectionId(+id);
  }

}
