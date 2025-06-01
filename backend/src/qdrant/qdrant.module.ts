import { Module } from '@nestjs/common';
import { QdrantService } from './qdrant.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [QdrantService],
  exports: [QdrantService],
})
export class QdrantModule {}
