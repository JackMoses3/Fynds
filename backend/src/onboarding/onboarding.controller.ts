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
import { ProductItemTransferDto } from 'src/product-item/dto/product-item.dto';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Public()
  @Get('style-products')
  async getStyleProducts(
    @Query('styleIds') styleIdsString: string,
    @Query('clothingPreference') clothingPreference: string,
    @Query('limit', ParseIntPipe) limit: number = 25, // Changed to 25
  ): Promise<ProductItemTransferDto[]> {
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

  @Public()
  @Get('images/:genderFolder/styles/:styleId/:filename')
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

    console.log(`🖼️ [Images] Attempting to serve: ${filePath}`);

    // Check if file exists first
    if (!fs.existsSync(filePath)) {
      console.log(`❌ [Images] File not found: ${filePath}`);
      return res.status(404).json({ error: 'Image not found' });
    }

    try {
      // Set proper headers for image serving
      const ext = path.extname(filename).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Access-Control-Allow-Origin', '*'); // Allow CORS

      console.log(`✅ [Images] Serving: ${filename} as ${contentType}`);

      return res.sendFile(path.resolve(filePath));
    } catch (error) {
      console.error(`❌ [Images] Error serving image:`, error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}
