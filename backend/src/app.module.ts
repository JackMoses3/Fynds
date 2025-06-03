/* eslint-disable */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';

import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ScraperModule } from './scraper/scraper.module';
import { MailerModule } from './mailer/mailer.module';
import { StyleModule } from './style/style.module';
import { CollectionModule } from './collection/collection.module';
import { ProductItemModule } from './product-item/product-item.module';
import { ShoppingTrolleyModule } from './shopping-trolley/shopping-trolley.module';
import { EmbeddingModule } from './embedding/embedding.module'; // Import the embedding module
import { QdrantModule } from './qdrant/qdrant.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid(
          'development',
          'production',
          'test',
          'provision',
        ),
        PORT: Joi.number().port().default(3000),
        DATABASE_URL: Joi.string().required(),
        AUTH_SECRET: Joi.string().required(),
        REFRESH_SECRET: Joi.string().required(),
        GOOGLE_CLIENT_ID: Joi.string().required(),
        GOOGLE_CLIENT_SECRET: Joi.string().required(),
        GOOGLE_CALLBACK_URL: Joi.string().required(),
        GOOGLE_CLIENT_ID_ANDROID: Joi.string().required(),
        GOOGLE_CLIENT_ID_IOS: Joi.string().required(),
        MAIL_USER: Joi.string().email().required(),
        MAIL_PASS: Joi.string().required(),
      }),
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),

    // Cast to any to satisfy TS; at runtime it still gets applied
    ThrottlerModule.forRoot({
      ttl: 60, // seconds
      limit: 10, // requests per ttl
    } as any),

    DatabaseModule,
    AuthModule,
    UserModule,
    ScraperModule,
    MailerModule,
    StyleModule,
    CollectionModule,
    ProductItemModule,
    ShoppingTrolleyModule,
    EmbeddingModule, // Register the embedding module
    QdrantModule,
  ],
})
export class AppModule {}
