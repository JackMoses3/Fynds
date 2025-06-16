import { Injectable } from '@nestjs/common';
import { ProductItemTransferDto } from 'src/product-item/dto/product-item.dto';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class OnboardingService {
  private readonly imagesBasePath = path.join(__dirname, '../onboarding');

  async getStyleProducts(
    selectedStyleIds: number[],
    clothingPreference: string,
    limit = 25, // Changed to 25
  ): Promise<ProductItemTransferDto[]> {
    const startTime = Date.now();

    // Determine gender folder
    const genderFolder = this.getGenderFolder(clothingPreference);
    const imagesPath = path.join(this.imagesBasePath, genderFolder, 'styles');

    console.log(`🔍 [Onboarding] Using images from: ${imagesPath}`);
    console.log(
      `🎯 [Onboarding] Selected styles: [${selectedStyleIds.join(', ')}]`,
    );

    const results: Array<{ id: number; imageUrl: string }> = [];

    try {
      // 1) Take 3 items from each selected style
      for (const styleId of selectedStyleIds) {
        if (results.length >= limit) break;

        const styleDir = path.join(imagesPath, styleId.toString());

        try {
          const files = await fs.readdir(styleDir);
          const imageFiles = files.filter(
            (file) =>
              file.toLowerCase().endsWith('.jpg') ||
              file.toLowerCase().endsWith('.jpeg') ||
              file.toLowerCase().endsWith('.png'),
          );

          console.log(
            `📂 [Onboarding] Style ${styleId}: found ${imageFiles.length} images`,
          );

          // Shuffle for randomness and take up to 3
          const shuffled = this.shuffle(imageFiles);
          const toTake = Math.min(3, shuffled.length, limit - results.length);

          for (let i = 0; i < toTake; i++) {
            const fileName = shuffled[i];
            const productId = parseInt(path.parse(fileName).name);

            if (!isNaN(productId)) {
              const imageUrl = `/api/onboarding/images/${genderFolder}/styles/${styleId}/${fileName}`;
              results.push({
                id: productId,
                imageUrl: imageUrl,
              });
              console.log(
                `🔗 [Onboarding] Generated URL: ${imageUrl} for product ${productId}`,
              );
            }
          }

          console.log(
            `📦 [Onboarding] Added ${toTake} items from style ${styleId}`,
          );
        } catch (error) {
          console.warn(
            `⚠️ [Onboarding] Style directory ${styleId} not found or empty`,
          );
        }
      }

      // 2) Fill remaining space with items from other styles (1 image each)
      const remaining = limit - results.length;
      console.log(
        `🔄 [Onboarding] Need ${remaining} more items from other styles`,
      );

      if (remaining > 0) {
        const usedIds = new Set(results.map((r) => r.id));

        try {
          // Get all available style directories
          const allStyleDirs = await fs.readdir(imagesPath);
          const availableStyleIds = allStyleDirs
            .filter((dir) => !selectedStyleIds.includes(parseInt(dir)))
            .map((dir) => parseInt(dir))
            .filter((id) => !isNaN(id));

          console.log(
            `📊 [Onboarding] Available other styles: [${availableStyleIds.join(', ')}]`,
          );

          // Shuffle style order for randomness
          const shuffledStyles = this.shuffle(availableStyleIds);

          for (const styleId of shuffledStyles) {
            if (results.length >= limit) break;

            const styleDir = path.join(imagesPath, styleId.toString());

            try {
              const files = await fs.readdir(styleDir);
              const imageFiles = files.filter(
                (file) =>
                  file.toLowerCase().endsWith('.jpg') ||
                  file.toLowerCase().endsWith('.jpeg') ||
                  file.toLowerCase().endsWith('.png'),
              );

              // Shuffle files and find one we haven't used
              const shuffledFiles = this.shuffle(imageFiles);

              for (const fileName of shuffledFiles) {
                const productId = parseInt(path.parse(fileName).name);

                if (!isNaN(productId) && !usedIds.has(productId)) {
                  const imageUrl = `/api/onboarding/images/${genderFolder}/styles/${styleId}/${fileName}`;
                  results.push({
                    id: productId,
                    imageUrl: imageUrl,
                  });
                  usedIds.add(productId);
                  console.log(
                    `📦 [Onboarding] Added 1 item from other style ${styleId}`,
                  );
                  break; // Only take 1 from each style
                }
              }
            } catch (error) {
              console.warn(
                `⚠️ [Onboarding] Could not read style directory ${styleId}`,
              );
            }
          }
        } catch (error) {
          console.warn(`⚠️ [Onboarding] Could not read main images directory`);
        }
      }

      // 3) Final shuffle for extra randomness
      const finalResults = this.shuffle(results).slice(0, limit);
      const productIds = finalResults.map((r) => r.id);
      const endTime = Date.now();

      console.log(
        `✅ [Onboarding] Returning ${finalResults.length} items in ${endTime - startTime}ms`,
      );
      console.log(`🆔 [Onboarding] Product IDs: [${productIds.join(', ')}]`);

      // Convert to ProductItemTransferDto format - minimal data needed
      return finalResults.map((item) => ({
        id: item.id,
        name: '',
        brand: '',
        category: '',
        price: 0,
        retailer: '',
        url: '',
        style: [],
        images: [
          {
            id: item.id,
            imageUrl: item.imageUrl,
            frontFacing: true,
          },
        ],
      }));
    } catch (error) {
      console.error(`❌ [Onboarding] Error loading cached images:`, error);
      return [];
    }
  }

  private getGenderFolder(clothingPreference: string): string {
    const pref = clothingPreference.toLowerCase();
    if (pref === 'male' || pref.includes('men')) {
      return 'men_images';
    } else if (pref === 'female' || pref.includes('women')) {
      return 'women_images';
    }
    return 'men_images';
  }

  private shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
