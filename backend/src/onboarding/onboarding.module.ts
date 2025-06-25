import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { DatabaseModule } from '../database/database.module';
import { ProductScoreService } from '../recommendation/service/product-score.service';

@Module({
  imports: [DatabaseModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, ProductScoreService],
})
export class OnboardingModule {}
