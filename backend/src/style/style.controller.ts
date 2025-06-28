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
import { RequestUser } from '../types';

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
    @Body() data: { limit?: number; offset?: number } = {},
    @Req() req: RequestUser,
  ) {
    return this.styleService.getProductsByStyle(
      req.user.sub,
      styleId,
      data.limit || 50,
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
