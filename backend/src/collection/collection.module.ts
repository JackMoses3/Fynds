import { Module } from '@nestjs/common';
import { CollectionService } from './collection.service';
import { CollectionController } from './collection.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  controllers: [CollectionController],
  providers: [CollectionService],
  imports: [DatabaseModule],
})
export class CollectionModule {}
