import { Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { EmbeddingController } from './embedding.controller';
import { HttpModule } from '@nestjs/axios';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  imports: [HttpModule],
  controllers: [EmbeddingController],
  providers: [EmbeddingService, PrismaService],
})
export class EmbeddingModule {}
