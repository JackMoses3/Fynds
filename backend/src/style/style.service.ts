import { Injectable } from '@nestjs/common';
import { CreateStyleDto } from './dto/create-style.dto';
import { UpdateStyleDto } from './dto/update-style.dto';
import { DatabaseService } from '../database/database.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class StyleService {
  constructor(private readonly db: DatabaseService) {}
  
  async create(createStyleDto: Prisma.StyleCreateInput) {
    return this.db.style.create({
      data: createStyleDto,
    });
  }

  async findAll() {
    return this.db.style.findMany();
  }

  async findOne(id: number) {
    return this.db.style.findUnique({
      where: { id }, 
  });
}

  async update(id: number, updateStyleDto: Prisma.StyleUpdateInput) {
    return this.db.style.update({
      where: { id },
      data: updateStyleDto,
    });
  }

  remove(id: number) {
    return this.db.style.delete({
      where: { id },
    });
  }
}
