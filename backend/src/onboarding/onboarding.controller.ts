import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  Param,
  Res,
} from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { Public } from '../types';
import { ProductItemTransferDto } from '../product-item/dto/product-item.dto';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

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
  @Public()
  @Get('style-products')
  async getStyleProducts(
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

    // Delegate to service layer for business logic
    return this.onboardingService.getStyleProducts(
      styleIds,
      clothingPreference,
      limit,
    );
  }

  /**
   * GET /api/onboarding/images/:genderFolder/styles/:styleId/:filename
   *
   * Static file server for product images during onboarding
   * Serves images from the filesystem with proper caching and CORS headers
   *
   * Path Structure:
   * - genderFolder: "men_images" or "women_images"
   * - styleId: Numeric style identifier (e.g., "1", "2", "3")
   * - filename: Image filename with extension (e.g., "12345.jpg")
   *
   * Example URL: /api/onboarding/images/women_images/styles/1/12345.jpg
   *
   * Features:
   * - File existence validation
   * - Proper Content-Type headers (image/jpeg or image/png)
   * - Cache headers for performance (1 hour cache)
   * - CORS headers for cross-origin requests
   * - Error handling for missing files
   *
   * @Public decorator allows image access without authentication
   */
  @Public()
  @Get('images/:genderFolder/styles/:styleId/:filename')
  async getImage(
    @Param('genderFolder') genderFolder: string,
    @Param('styleId') styleId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    // Build absolute file path from URL parameters
    const filePath = path.join(
      __dirname,
      '../onboarding',
      genderFolder,
      'styles',
      styleId,
      filename,
    );

    console.log(`🖼️ [Images] Attempting to serve: ${filePath}`);

    // Validate file exists before attempting to serve
    if (!fs.existsSync(filePath)) {
      console.log(`❌ [Images] File not found: ${filePath}`);
      return res.status(404).json({ error: 'Image not found' });
    }

    try {
      // Determine Content-Type based on file extension
      const ext = path.extname(filename).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';

      // Set HTTP headers for optimal image delivery
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache
      res.setHeader('Access-Control-Allow-Origin', '*'); // Allow CORS

      console.log(`✅ [Images] Serving: ${filename} as ${contentType}`);

      // Send file using Express's optimized file serving
      return res.sendFile(path.resolve(filePath));
    } catch (error) {
      console.error(`❌ [Images] Error serving image:`, error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}
