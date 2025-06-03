import { Module } from '@nestjs/common';
import { EmbeddingQdrantService } from './embedding-qdrant.service';
import { EmbeddingModule } from '../embedding/embedding.module';
import { QdrantModule } from '../qdrant/qdrant.module';
import { DatabaseModule } from '../database/database.module';
import { EmbeddingQdrantController } from './embedding-qdrant.controller';

@Module({
  imports: [EmbeddingModule, QdrantModule, DatabaseModule],
  controllers: [EmbeddingQdrantController],
  providers: [EmbeddingQdrantService],
  exports: [EmbeddingQdrantService],
})
export class EmbeddingQdrantModule {}
