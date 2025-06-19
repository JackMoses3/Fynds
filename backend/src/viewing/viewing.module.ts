import { Module } from '@nestjs/common';
import { ViewingService } from './viewing.service';
import { ViewingController } from './viewing.controller';
import { DatabaseService } from '../database/database.service';

@Module({
  providers: [ViewingService, DatabaseService],
  controllers: [ViewingController],
  exports: [ViewingService],
})
export class ViewingModule {}
