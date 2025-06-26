/* eslint-disable */
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { StyleService } from './style.service';
import { Prisma } from '../../generated/prisma';
import { RequestUser } from 'src/types';

@Controller('style')
export class StyleController {
  constructor(private readonly styleService: StyleService) {}

  @Get()
  findAll() {
    return this.styleService.findAll();
  }

  // GET /api/style/:styleId/products
  @Get(':styleId/products')
  async getProductsByStyle(
    @Param('styleId', ParseIntPipe) styleId: number,
    @Query('limit', ParseIntPipe) limit: number = 50,
    @Query('offset', ParseIntPipe) offset: number = 0,
    @Req() req: RequestUser,
  ) {
    return this.styleService.getProductsByStyle(
      req.user.sub,
      styleId,
      limit,
      offset,
    );
  }

  // GET /api/style/:styleId/products/count
  @Get(':styleId/products/count')
  async getProductCountByStyle(
    @Param('styleId', ParseIntPipe) styleId: number,
    @Req() req: RequestUser,
  ) {
    const count = await this.styleService.getProductCountByStyle(
      req.user.sub,
      styleId,
    );
    return { count };
  }
}
