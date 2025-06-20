import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Signal types for user interactions
 */
export enum SignalType {
  ONBOARDING = 'onboarding',
  LIKE = 'like',
  COLLECTION = 'collection',
  TROLLEY = 'trolley',
  VIEWING = 'viewing',
}

/**
 * Individual user interaction signal
 */
export interface UserSignal {
  productId: number;
  weight: number;
  createdAt: Date;
  source: SignalType;
  scrollLength?: number;
  scrollDepth?: number;
}

/**
 * Feed batch metadata
 */
export interface FeedBatchMeta {
  userId: number;
  generatedAt: string;
  stage: number;
  totalProcessed: number;
  totalSuccessful: number;
  totalFailed: number;
}

/**
 * Product item for feed response
 */
export interface ProductItemDto {
  id: number;
  name: string;
  brand: string;
  category: string | null;
  price: number;
  retailer: string;
  url: string;
  sex: string;
  images: Array<{
    id: number;
    imageUrl: string;
    frontFacing: boolean | null;
  }>;
  styles: string[];
}

/**
 * Complete feed batch response
 */
export interface FeedBatchDto {
  batchMeta: FeedBatchMeta;
  products: ProductItemDto[];
}

/**
 * Query parameters for personalized feed
 */
export class PersonalizedFeedQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stage: number = 0;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

/**
 * Signal collection configuration
 */
export interface SignalConfig {
  baseWeight: number;
  recencyDecayHours: number;
  additionalBoost?: number;
  maxWeight?: number;
}

/**
 * Qdrant search result with metadata
 */
export interface QdrantSearchResult {
  id: number;
  score: number;
  payload?: Record<string, any>;
}

/**
 * Segment types for feed composition
 */
export enum SegmentType {
  RECENT = 'recent',
  HISTORICAL = 'historical',
  RANDOM = 'random',
}

/**
 * Feed segment with metadata
 */
export interface FeedSegment {
  type: SegmentType;
  productIds: number[];
  sourceSignals?: UserSignal[];
}

/**
 * Cold start detection result
 */
export interface ColdStartInfo {
  isColdStart: boolean;
  userAgeDays: number;
  totalInteractions: number;
  onboardingWeightMultiplier: number;
  randomQuota: number;
} 