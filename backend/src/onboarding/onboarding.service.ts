import { Injectable } from '@nestjs/common';
import { ProductItemTransferDto } from '../product-item/dto/product-item.dto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ProductScoreService } from '../recommendation/service/product-score.service';

@Injectable()
export class OnboardingService {
  private readonly imagesBasePath = path.join(__dirname, '../onboarding');

  constructor(private readonly productScoreService: ProductScoreService) {}

  async getStyleProducts(
    userId: number, // <-- add this parameter
    selectedStyleIds: number[],
    clothingPreference: string,
    limit = 25,
  ): Promise<ProductItemTransferDto[]> {
    const startTime = Date.now();
    const pref = clothingPreference.toLowerCase();

    if (pref === 'both') {
      // Handle "both" case: 12 male + 13 female
      console.log(
        `🔍 [Onboarding] Both genders requested: 12 male + 13 female`,
      );

      const maleItems = await this.loadFromGenderFolder(
        userId,
        selectedStyleIds,
        'men_images',
        12,
      );
      const femaleItems = await this.loadFromGenderFolder(
        userId,
        selectedStyleIds,
        'women_images',
        13,
      );

      // Combine and shuffle for final randomness
      const combined = this.shuffle([...maleItems, ...femaleItems]);
      const endTime = Date.now();

      console.log(
        `✅ [Onboarding] Returning ${combined.length} items (${maleItems.length} male + ${femaleItems.length} female) in ${endTime - startTime}ms`,
      );

      return this.convertToDto(combined.slice(0, limit));
    }

    // Single gender case
    const genderFolder = this.getGenderFolder(clothingPreference);
    const items = await this.loadFromGenderFolder(
      userId,
      selectedStyleIds,
      genderFolder,
      limit,
    );

    const endTime = Date.now();
    console.log(
      `✅ [Onboarding] Returning ${items.length} items from ${genderFolder} in ${endTime - startTime}ms`,
    );

    return this.convertToDto(this.shuffle(items).slice(0, limit));
  }

  private async loadFromGenderFolder(
    userId: number, // <-- add this parameter
    selectedStyleIds: number[],
    genderFolder: string,
    targetLimit: number,
  ): Promise<Array<{ id: number; imageUrl: string }>> {
    const imagesPath = path.join(this.imagesBasePath, genderFolder, 'styles');
    const results: Array<{ id: number; imageUrl: string }> = [];

    console.log(
      `🔍 [Onboarding] Loading from: ${imagesPath} (limit: ${targetLimit})`,
    );
    console.log(
      `🎯 [Onboarding] Selected styles: [${selectedStyleIds.join(', ')}]`,
    );

    try {
      // 1) Take up to 3 items from each selected style
      for (const styleId of selectedStyleIds) {
        if (results.length >= targetLimit) break;

        const styleDir = path.join(imagesPath, styleId.toString());

        try {
          const files = await fs.readdir(styleDir);
          const imageFiles = files.filter((file) =>
            /\.(jpe?g|png)$/i.test(file),
          );

          console.log(
            `📂 [Onboarding] Style ${styleId}: found ${imageFiles.length} images`,
          );

          // Shuffle and take up to 3
          const shuffled = this.shuffle(imageFiles);
          const toTake = Math.min(
            3,
            shuffled.length,
            targetLimit - results.length,
          );

          for (let i = 0; i < toTake; i++) {
            const fileName = shuffled[i];
            const productId = parseInt(path.parse(fileName).name);

            if (!isNaN(productId)) {
              const imageUrl = `/api/onboarding/images/${genderFolder}/styles/${styleId}/${fileName}`;
              results.push({ id: productId, imageUrl });
              console.log(
                `🔗 [Onboarding] Generated URL: ${imageUrl} for product ${productId}`,
              );

              // Add to ProductScore for this user
              await this.productScoreService.addScore({
                userId,
                productItemId: productId,
                signals: { onboarding: true },
              });
            }
          }

          console.log(
            `📦 [Onboarding] Added ${toTake} items from style ${styleId}`,
          );
        } catch (error) {
          console.warn(`⚠️ [Onboarding] Style directory ${styleId} not found`);
        }
      }

      // 2) Fill remaining space with items from other styles (1 each)
      const remaining = targetLimit - results.length;
      console.log(
        `🔄 [Onboarding] Need ${remaining} more items from other styles`,
      );

      if (remaining > 0) {
        const usedIds = new Set(results.map((r) => r.id));

        try {
          const allStyleDirs = await fs.readdir(imagesPath);
          const availableStyleIds = allStyleDirs
            .filter((dir) => !selectedStyleIds.includes(parseInt(dir)))
            .map((dir) => parseInt(dir))
            .filter((id) => !isNaN(id));

          console.log(
            `📊 [Onboarding] Available other styles: [${availableStyleIds.join(', ')}]`,
          );

          const shuffledStyles = this.shuffle(availableStyleIds);

          for (const styleId of shuffledStyles) {
            if (results.length >= targetLimit) break;

            const styleDir = path.join(imagesPath, styleId.toString());

            try {
              const files = await fs.readdir(styleDir);
              const imageFiles = files.filter((file) =>
                /\.(jpe?g|png)$/i.test(file),
              );

              const shuffledFiles = this.shuffle(imageFiles);

              for (const fileName of shuffledFiles) {
                const productId = parseInt(path.parse(fileName).name);

                if (!isNaN(productId) && !usedIds.has(productId)) {
                  const imageUrl = `/api/onboarding/images/${genderFolder}/styles/${styleId}/${fileName}`;
                  results.push({ id: productId, imageUrl });
                  usedIds.add(productId);
                  console.log(
                    `📦 [Onboarding] Added 1 item from other style ${styleId}`,
                  );
                  // Optionally, you can also add these to ProductScore if you want
                  await this.productScoreService.addScore({
                    userId,
                    productItemId: productId,
                    signals: { onboarding: true },
                  });
                  break; // Only 1 per style
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

      return results.slice(0, targetLimit);
    } catch (error) {
      console.error(
        `❌ [Onboarding] Error loading from ${genderFolder}:`,
        error,
      );
      return [];
    }
  }

  private convertToDto(
    items: Array<{ id: number; imageUrl: string }>,
  ): ProductItemTransferDto[] {
    const productIds = items.map((r) => r.id);
    console.log(`🆔 [Onboarding] Product IDs: [${productIds.join(', ')}]`);

    return items.map((item) => ({
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
