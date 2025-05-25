import { Module } from '@nestjs/common';
import { ShoppingTrolleyService } from './shopping-trolley.service';
import { ShoppingTrolleyController } from './shopping-trolley.controller';
import { DatabaseModule } from '../database/database.module';  // ← import here

@Module({
    imports: [DatabaseModule],          // ← add to imports
    providers: [ShoppingTrolleyService],
    controllers: [ShoppingTrolleyController],
})
export class ShoppingTrolleyModule { }
