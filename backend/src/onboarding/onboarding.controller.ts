import { Controller, Get, Query, ParseIntPipe } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { Public } from '../types';
import { ProductItemTransferDto } from 'src/product-item/dto/product-item.dto';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Public()
  @Get('style-products')
  async getStyleProducts(
    @Query('styleIds') styleIdsString: string, // ✅ Changed to accept comma-separated string
    @Query('clothingPreference') clothingPreference: string,
    @Query('limit', ParseIntPipe) limit: number = 50, // ✅ Default to 50
  ): Promise<ProductItemTransferDto[]> {
    // Parse comma-separated style IDs
    const styleIds = styleIdsString
      .split(',')
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !isNaN(id));

    if (styleIds.length === 0) {
      throw new Error('At least one style ID must be provided');
    }

    return this.onboardingService.getStyleProducts(
      styleIds,
      clothingPreference,
      limit,
    );
  }
}
