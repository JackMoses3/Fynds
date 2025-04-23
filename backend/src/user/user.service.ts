import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UserService {
  constructor(private readonly db: DatabaseService) {}

  async create(createUserDto: Prisma.UserCreateInput) {
    return this.db.user.create({ data: createUserDto });
  }

  async findAll() {
    return this.db.user.findMany();
  }

  async findOneById(id: number) {
    return this.db.user.findUnique({ where: { id } });
  }

  async findOneByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }

  async update(id: number, updateUserDto: Prisma.UserUpdateInput) {
    console.log('📤 Updating user with ID:', id);
    console.log('📝 Data:', updateUserDto);
    return this.db.user.update({ where: { id }, data: updateUserDto });
  }

  async remove(id: number) {
    return this.db.user.delete({ where: { id } });
  }

  async removeByEmail(email: string) {
    return this.db.user.delete({ where: { email } });
  }

  async assignStylesToUser(userId: number, styleIds: number[]) {
    const data = styleIds.map((styleId) => ({
      userId,
      styleId,
    }));
  
    return this.db.userStyle.createMany({
      data,
      skipDuplicates: true, // avoid unique constraint errors
    });
  }

}