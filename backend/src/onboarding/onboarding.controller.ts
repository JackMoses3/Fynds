import { Controller, Req, UseGuards, Body, Post } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/strategies/jwt/jwt-auth.guard';
import { OnboardingService } from './onboarding.service';
import { RequestUser } from '../types';
import { ProductScoreService } from '../recommendation/service/product-score.service';
import { ProductIdWithImageDto } from './dto/style-images.dto';
import { StyleWithImageDto } from './dto/style-with-image.dto';

class CompleteOnboardingDto {
  selectedIds!: number[];
}

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly productScoreService: ProductScoreService,
  ) {}

  /**
   * GET /api/onboarding/style-products
   *
   * Main endpoint for retrieving product recommendations during onboarding
   * Based on user's selected styles and clothing preference, returns curated product images
   *
   * Query Parameters:
   * - styleIds: Comma-separated list of style IDs user selected (e.g., "1,3,5")
   * - clothingPreference: User's gender preference ("Male", "Female", or "Both")
   * - limit: Maximum number of products to return (default: 25)
   *
   * Logic:
   * - If "Both": Returns 12 male + 13 female products
   * - If single gender: Returns 25 products from that gender's folder
   * - Priority: 3 items from each selected style, then fills with items from other styles
   *
   */
  @Post('style-products')
  async getStyleProducts(
    @Body()
    data: {
      styleIds: number[];
      clothingPreference: string;
      limit?: number;
    },
  ): Promise<ProductIdWithImageDto[]> {
    // Delegate to service layer for business logic
    return this.onboardingService.getStyleProducts(
      data.styleIds,
      data.clothingPreference,
      data.limit,
    );
  }

  /** POST /onboarding/complete */
  @Post('complete')
  async complete(@Req() req: RequestUser, @Body() dto: CompleteOnboardingDto) {
    const userId = req.user.sub;
    const { selectedIds } = dto;

    for (const productItemId of selectedIds) {
      await this.productScoreService.addScore({
        userId,
        productItemId,
        signals: { onboarding: true },
      });
    }

    return { success: true };
  }

  /** POST /onboarding/style-images */
  @Post('style-images')
  async getStyleImages(
    @Body() body: { clothingPreference: string },
  ): Promise<StyleWithImageDto[]> {
    console.log('🎯 [OnboardingController] POST /onboarding/style-images');
    console.log(
      `📋 [OnboardingController] Clothing Preference: ${body.clothingPreference}`,
    );

    const result = await this.onboardingService.getStyleImages(
      body.clothingPreference,
    );

    console.log(
      `✅ [OnboardingController] Returning ${result.length} styles with images`,
    );
    return result;
  }
}
