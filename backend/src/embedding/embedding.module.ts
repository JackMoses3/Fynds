import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { EmbeddingService } from './embedding.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 15_000,
      maxRedirects: 3,
    }),
  ],
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
