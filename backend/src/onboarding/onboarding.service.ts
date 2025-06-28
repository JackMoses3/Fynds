/* eslint-disable */
import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ProductIdWithImageDto } from './dto/style-images.dto';

@Injectable()
export class OnboardingService {
  private readonly imagesBasePath = path.join(__dirname, '../onboarding');

  async getStyleProducts(
    selectedStyleIds: number[],
    clothingPreference: string,
    limit = 25,
  ): Promise<ProductIdWithImageDto[]> {
    console.log('🎯 [OnboardingService] Starting getStyleProducts');
    console.log(
      `📋 [OnboardingService] Selected Style IDs: ${selectedStyleIds}`,
    );
    console.log(
      `👥 [OnboardingService] Clothing Preference: ${clothingPreference}`,
    );
    console.log(`🔢 [OnboardingService] Limit: ${limit}`);
    console.log(
      `📁 [OnboardingService] Base images path: ${this.imagesBasePath}`,
    );

    const result: ProductIdWithImageDto[] = [];

    if (clothingPreference === 'unisex') {
      console.log(
        '🔀 [OnboardingService] Using unisex preference - loading both genders',
      );

      const menProducts = await this.loadProductsWithImagesForGender(
        selectedStyleIds,
        'men',
        12,
      );
      console.log(
        `👨 [OnboardingService] Men products loaded: ${menProducts.length}`,
      );

      const womenProducts = await this.loadProductsWithImagesForGender(
        selectedStyleIds,
        'women',
        13,
      );
      console.log(
        `👩 [OnboardingService] Women products loaded: ${womenProducts.length}`,
      );

      result.push(...menProducts, ...womenProducts);
    } else {
      console.log(
        `🎯 [OnboardingService] Loading single gender: ${clothingPreference}`,
      );

      const products = await this.loadProductsWithImagesForGender(
        selectedStyleIds,
        clothingPreference,
        limit,
      );
      console.log(
        `📦 [OnboardingService] Single gender products loaded: ${products.length}`,
      );
      result.push(...products);
    }

    const shuffledResult = this.shuffleArray(result).slice(0, limit);
    console.log(
      `✅ [OnboardingService] Final result: ${shuffledResult.length} products`,
    );

    // Log first few product IDs for verification
    const firstFewIds = shuffledResult.slice(0, 5).map((p) => p.id);
    console.log(
      `🆔 [OnboardingService] First few product IDs: ${firstFewIds.join(', ')}`,
    );

    return shuffledResult;
  }

  private async loadProductsWithImagesForGender(
    selectedStyleIds: number[],
    genderFolder: string,
    targetLimit: number,
  ): Promise<ProductIdWithImageDto[]> {
    console.log(`\n🚀 [LoadGender] Starting load for gender: ${genderFolder}`);
    console.log(`🎯 [LoadGender] Target limit: ${targetLimit}`);

    const imagesPath = path.join(this.imagesBasePath, genderFolder, 'styles');
    console.log(`📁 [LoadGender] Images path: ${imagesPath}`);

    // Check if the gender folder exists
    try {
      await fs.access(this.imagesBasePath);
      console.log(`✅ [LoadGender] Base path exists: ${this.imagesBasePath}`);
    } catch (error) {
      console.error(
        `❌ [LoadGender] Base path does not exist: ${this.imagesBasePath}`,
      );
      return [];
    }

    try {
      await fs.access(path.join(this.imagesBasePath, genderFolder));
      console.log(`✅ [LoadGender] Gender folder exists: ${genderFolder}`);
    } catch (error) {
      console.error(
        `❌ [LoadGender] Gender folder does not exist: ${genderFolder}`,
      );
      return [];
    }

    try {
      await fs.access(imagesPath);
      console.log(`✅ [LoadGender] Styles folder exists: ${imagesPath}`);
    } catch (error) {
      console.error(
        `❌ [LoadGender] Styles folder does not exist: ${imagesPath}`,
      );
      return [];
    }

    const result: ProductIdWithImageDto[] = [];
    const usedIds = new Set<number>();

    try {
      // 1) Take up to 3 items from each selected style
      console.log(`\n🎨 [LoadGender] Phase 1: Loading from selected styles`);
      for (const styleId of selectedStyleIds) {
        if (result.length >= targetLimit) {
          console.log(
            `🛑 [LoadGender] Reached target limit during style ${styleId}`,
          );
          break;
        }

        console.log(`📂 [LoadGender] Processing style ID: ${styleId}`);

        const styleImages = await this.getImagesFromStyle(
          imagesPath,
          styleId,
          3,
          usedIds,
        );

        console.log(
          `🖼️ [LoadGender] Style ${styleId} returned ${styleImages.length} images`,
        );

        const toAdd = Math.min(styleImages.length, targetLimit - result.length);
        result.push(...styleImages.slice(0, toAdd));

        console.log(
          `➕ [LoadGender] Added ${toAdd} images from style ${styleId}. Total: ${result.length}`,
        );

        // Update used IDs
        styleImages.slice(0, toAdd).forEach((img) => usedIds.add(img.id));
      }

      // 2) Fill remaining space with items from other styles
      if (result.length < targetLimit) {
        console.log(
          `\n🔄 [LoadGender] Phase 2: Need ${targetLimit - result.length} more images`,
        );

        const allStyleDirs = await fs.readdir(imagesPath);
        console.log(
          `📁 [LoadGender] Available style directories: ${allStyleDirs.join(', ')}`,
        );

        const otherStyleIds = allStyleDirs
          .filter((dir) => !selectedStyleIds.includes(parseInt(dir)))
          .map((dir) => parseInt(dir))
          .filter((id) => !isNaN(id));

        console.log(
          `🎯 [LoadGender] Other style IDs to use: ${otherStyleIds.join(', ')}`,
        );

        const shuffledOtherStyles = this.shuffleArray(otherStyleIds);
        console.log(
          `🔀 [LoadGender] Shuffled other styles: ${shuffledOtherStyles.join(', ')}`,
        );

        for (const styleId of shuffledOtherStyles) {
          if (result.length >= targetLimit) {
            console.log(
              `🛑 [LoadGender] Reached target limit during other style ${styleId}`,
            );
            break;
          }

          console.log(`📂 [LoadGender] Processing other style ID: ${styleId}`);

          const styleImages = await this.getImagesFromStyle(
            imagesPath,
            styleId,
            1, // Only 1 from each other style
            usedIds,
          );

          if (styleImages.length > 0) {
            result.push(styleImages[0]);
            usedIds.add(styleImages[0].id);
            console.log(
              `➕ [LoadGender] Added 1 image from other style ${styleId}. Total: ${result.length}`,
            );
          } else {
            console.log(
              `⚠️ [LoadGender] No new images from other style ${styleId}`,
            );
          }
        }
      }

      console.log(
        `✅ [LoadGender] Completed ${genderFolder}: ${result.length} images total`,
      );
      return result.slice(0, targetLimit);
    } catch (error) {
      console.error(
        `❌ [LoadGender] Error loading from ${genderFolder}:`,
        error,
      );
      return [];
    }
  }

  private async getImagesFromStyle(
    imagesPath: string,
    styleId: number,
    maxImages: number,
    usedIds: Set<number>,
  ): Promise<ProductIdWithImageDto[]> {
    console.log(
      `  🎨 [GetImages] Processing style ${styleId}, max: ${maxImages}`,
    );

    const styleDir = path.join(imagesPath, styleId.toString());
    console.log(`  📁 [GetImages] Style directory: ${styleDir}`);

    const results: ProductIdWithImageDto[] = [];

    try {
      // Check if style directory exists
      await fs.access(styleDir);
      console.log(`  ✅ [GetImages] Style directory exists`);

      const files = await fs.readdir(styleDir);
      console.log(`  📄 [GetImages] Files in directory: ${files.join(', ')}`);

      const imageFiles = files.filter((file) => /\.(jpe?g|png)$/i.test(file));
      console.log(
        `  🖼️ [GetImages] Image files found: ${imageFiles.join(', ')}`,
      );

      if (imageFiles.length === 0) {
        console.log(
          `  ⚠️ [GetImages] No image files found in style ${styleId}`,
        );
        return [];
      }

      const shuffledFiles = this.shuffleArray(imageFiles);
      console.log(
        `  🔀 [GetImages] Shuffled files: ${shuffledFiles.slice(0, 3).join(', ')}${shuffledFiles.length > 3 ? '...' : ''}`,
      );

      for (const fileName of shuffledFiles) {
        if (results.length >= maxImages) {
          console.log(
            `  🛑 [GetImages] Reached max images (${maxImages}) for style ${styleId}`,
          );
          break;
        }

        const productId = parseInt(path.parse(fileName).name);
        console.log(
          `  🆔 [GetImages] Processing file: ${fileName} -> Product ID: ${productId}`,
        );

        // Skip if invalid ID or already used
        if (isNaN(productId)) {
          console.log(
            `  ⚠️ [GetImages] Invalid product ID from filename: ${fileName}`,
          );
          continue;
        }

        if (usedIds.has(productId)) {
          console.log(
            `  ⚠️ [GetImages] Product ID ${productId} already used, skipping`,
          );
          continue;
        }

        const filePath = path.join(styleDir, fileName);

        try {
          // Read image file and convert to base64
          const imageBuffer = await fs.readFile(filePath);
          const base64Image = imageBuffer.toString('base64');
          const imageSizeKB = Math.round(imageBuffer.length / 1024);

          console.log(
            `  📸 [GetImages] Successfully processed ${fileName}: ${imageSizeKB}KB -> ${base64Image.length} base64 chars`,
          );

          results.push({
            id: productId,
            imageData: base64Image,
          });
        } catch (fileError) {
          console.error(
            `  ❌ [GetImages] Could not read image file ${filePath}:`,
            fileError,
          );
        }
      }

      console.log(
        `  ✅ [GetImages] Style ${styleId} completed: ${results.length} images processed`,
      );
    } catch (dirError) {
      console.warn(
        `  ❌ [GetImages] Style directory ${styleId} not found or inaccessible:`,
        dirError,
      );
    }

    return results;
  }

  private shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
