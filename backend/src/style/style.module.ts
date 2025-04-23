import { Module } from '@nestjs/common';
import { StyleService } from './style.service';
import { StyleController } from './style.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  controllers: [StyleController],
  providers: [StyleService],
  imports: [DatabaseModule],
})
export class StyleModule {}
