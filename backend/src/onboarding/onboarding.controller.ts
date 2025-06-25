import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  Req,
  UseGuards,
  Param,
  Res,
  Body,
  Post,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/strategies/jwt/jwt-auth.guard';
import { OnboardingService } from './onboarding.service';
import { ProductItemTransferDto } from '../product-item/dto/product-item.dto';
import { RequestUser } from '../types';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { ProductScoreService } from '../recommendation/service/product-score.service';

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
  @Get('style-products')
  async getStyleProducts(
    @Req() req: RequestUser,
    @Query('styleIds') styleIdsString: string,
    @Query('clothingPreference') clothingPreference: string,
    @Query('limit', ParseIntPipe) limit: number = 25,
  ): Promise<ProductItemTransferDto[]> {
    // Parse comma-separated style IDs into array of integers
    const styleIds = styleIdsString
      .split(',')
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !isNaN(id));

    // Validate that at least one valid style ID was provided
    if (styleIds.length === 0) {
      throw new Error('At least one style ID must be provided');
    }

    // Use the same method as like.controller to get the user id
    const userId = req.user.sub;

    // Delegate to service layer for business logic
    return this.onboardingService.getStyleProducts(
      userId,
      styleIds,
      clothingPreference,
      limit,
    );
  }

  /**
   * GET  /api/onboarding/:genderFolder/styles/:styleId/:filename
   *
   * Serves images from src/onboarding/<genderFolder>/styles/... with
   * proper Content‐Type, cache and CORS headers.
   *
   * Public decorator not shown here—make sure this route is not guarded.
   */
  @Get(':genderFolder/styles/:styleId/:filename')
  async getImage(
    @Param('genderFolder') genderFolder: string,
    @Param('styleId') styleId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const filePath = path.join(
      __dirname,
      '../onboarding',
      genderFolder,
      'styles',
      styleId,
      filename,
    );

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Image not found: ${filename}`);
    }

    // Set MIME type
    const ext = path.extname(filename).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    res.type(mime);

    // Caching and CORS
    res.set('Cache-Control', 'public, max-age=3600');
    res.set('Access-Control-Allow-Origin', '*');

    return res.sendFile(filePath);
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
}
