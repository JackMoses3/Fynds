import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { StyleService } from './style.service';
import { CreateStyleDto } from './dto/create-style.dto';
import { UpdateStyleDto } from './dto/update-style.dto';
import { Prisma } from '@prisma/client';

@Controller('style')
export class StyleController {
  constructor(private readonly styleService: StyleService) {}

  @Post()
  create(@Body() createStyleDto: Prisma.StyleCreateInput) {
    return this.styleService.create(createStyleDto);
  }

  @Get()
  findAll() {
    return this.styleService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.styleService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStyleDto: Prisma.StyleUpdateInput) {
    return this.styleService.update(+id, updateStyleDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.styleService.remove(+id);
  }
}
