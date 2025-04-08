// src/graphql/health.resolver.ts
import { Query, Resolver } from '@nestjs/graphql';

@Resolver()
export class HealthResolver {
  @Query(() => String)
  healthCheck(): string {
    return 'GraphQL is running 🚀';
  }
}