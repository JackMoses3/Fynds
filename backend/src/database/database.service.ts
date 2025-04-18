import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit {
    async onModuleInit() {
        console.log('🚀 Connecting to the database...');
        await this.$connect();
        console.log('✅ Connected to the database!');
    }
}
