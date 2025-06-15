import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ProductItemTransferDto } from 'src/product-item/dto/product-item.dto';

@Injectable()
export class OnboardingService {
  constructor(private readonly db: DatabaseService) {}

  async getStyleProducts(
    selectedStyleIds: number[],
    clothingPreference: string,
    limit = 50,
  ): Promise<ProductItemTransferDto[]> {
    // 1) Determine gender filter (null means “no filter”)
    const genderFilter = this.getGenderFilter(clothingPreference);
    const baseWhere: any = {};
    if (genderFilter) {
      baseWhere.sex = genderFilter;
    }

    console.log('🔍 [Onboarding] Incoming:', {
      selectedStyleIds,
      clothingPreference,
      genderFilter,
      limit,
    });

    // 2) Fetch 5 items per selected style
    const perStyle = await Promise.all(
      selectedStyleIds.map((styleId) =>
        this.db.productItem.findMany({
          where: {
            ...baseWhere,
            productStyles: { some: { styleId } },
          },
          select: this.selectClause(),
          take: 5,
          orderBy: { id: 'asc' },
        }),
      ),
    );
    const selected = perStyle.flat();
    console.log(
      `📦 [Onboarding] Found ${selected.length} items across selected styles`,
    );

    // 3) Fill up to `limit` with items from other styles
    const excludedIds = selected.map((p) => p.id);
    const remaining = Math.max(0, limit - selected.length);
    const randomOthers = remaining
      ? await this.db.productItem.findMany({
          where: {
            ...baseWhere,
            id: { notIn: excludedIds },
            productStyles: { some: { styleId: { notIn: selectedStyleIds } } },
          },
          select: this.selectClause(),
          take: remaining,
          orderBy: { id: 'desc' },
        })
      : [];
    console.log(
      `🧩 [Onboarding] Fetched ${randomOthers.length} random “other” items`,
    );

    let all = [...selected, ...randomOthers];

    // 4) FALLBACK: if still empty, ignore all filters and grab the first `limit` items
    if (all.length === 0) {
      console.warn(
        '⚠️ [Onboarding] No items found with filters, falling back to first items in DB',
      );
      all = await this.db.productItem.findMany({
        select: this.selectClause(),
        take: limit,
        orderBy: { id: 'asc' },
      });
      console.log(`🔄 [Onboarding] Fallback returned ${all.length} items`);
    }

    // 5) Final logging
    console.log(`✅ [Onboarding] Returning ${all.length} items total`);
    return all.slice(0, limit).map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      price: p.price,
      retailer: p.retailer,
      url: p.url,
      style: p.productStyles.map((ps) => ps.style.name),
      images: p.productImages,
    }));
  }

  private selectClause() {
    return {
      id: true,
      name: true,
      brand: true,
      category: true,
      price: true,
      retailer: true,
      url: true,
      productImages: {
        select: { id: true, imageUrl: true, frontFacing: true },
        orderBy: [{ frontFacing: 'desc' as const }, { id: 'asc' as const }],
        take: 1,
      },
      productStyles: {
        select: {
          style: { select: { id: true, name: true } },
        },
      },
    };
  }

  private getGenderFilter(pref: string): string | null {
    const p = pref.toLowerCase();
    if (p === 'male') return 'Male';
    if (p === 'female') return 'Female';
    return null; // both or unspecified
  }
}
