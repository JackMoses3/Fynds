import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ScraperModule } from './scraper/scraper.module';
import { ProductItemModule } from './product-item/product-item.module';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { HealthResolver } from './graphql/health.resolver';

@Module({
  imports: [DatabaseModule, ScraperModule, ProductItemModule,GraphQLModule.forRoot<ApolloDriverConfig>({
    driver: ApolloDriver,
    autoSchemaFile: 'schema.gql', // or true to generate in-memory
    playground: true, // optional: enable GraphQL playground in dev
    introspection: true, // optional: useful for tools like Apollo Studio
  }),],
  controllers: [AppController],
  providers: [AppService, HealthResolver],
})
export class AppModule {}
