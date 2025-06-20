# Personalized Recommendation System

This module implements a sophisticated personalized product recommendation system that replaces the basic `getRandomProducts()` endpoint with an intelligent "For You" feed tailored to each user's interaction signals.

## Architecture Overview

The recommendation system follows a multi-stage pipeline:

```
User Request → Signal Collection → Scoring → Segmentation → Qdrant Search → Filtering → Shuffling → Response
```

### Core Components

1. **RecommendationService** - Main orchestrator
2. **SignalService** - Collects and scores user interaction signals
3. **QdrantRecommendationService** - Handles vector similarity searches
4. **RecommendationController** - Exposes the API endpoints

## Signal Types & Weights

| Signal Type | Base Weight | Recency Decay (hours) | Additional Boost |
|-------------|-------------|----------------------|------------------|
| OnboardingProduct | 2.0 | 720 (30 days) | None |
| Like | 3.0 | 168 (7 days) | +0.5 if scrollDepth ≥ 3 |
| CollectionItem | 3.0 | 168 (7 days) | None |
| TrolleyItem | 4.0 | 168 (7 days) | None |
| ViewingHistory | 1.0 | 72 (3 days) | +0.2 if scrollLength ≥ 3000ms |

### Weight Calculation Formula

```
Final Weight = baseWeight * e^(-ageHours/τ) + boost
```

**Override**: If scrollDepth ≥ 5 or scrollLength ≥ 6000ms, clamp weight to min(currentWeight, 5.0)

## Feed Composition Algorithm

### 1. Signal Collection
- Fetches last 100 rows from each signal table
- Collects all onboarding products
- Materializes as `{ productId, weight, createdAt, source }[]`

### 2. Signal Scoring
- Applies exponential decay formula
- Sorts by weight descending
- Handles cold start adjustments

### 3. Segment Selection (20-item batch)
- **Recent**: Top 14 scored signals (< 7 days old)
- **Historical**: Top 3 from signals ≥ 7 days old
- **Random**: 3-6 items (6 for cold start users)

### 4. Qdrant Candidate Retrieval
- For each signal product: query k=30 nearest neighbors
- Filter out:
  - Products in user's latest 160 ViewingHistory
  - Products that were Liked, Saved, or Added to Trolley
- Maintain retailer diversity (≥ 3 distinct retailers)

### 5. Filtering & Diversification
- **Sex gate**: Filter by user's clothing preferences
- **Embedding filter**: Exclude products without embeddings
- **Category filter**: Exclude 'Uncategorized' products
- **Random diversity**: 20% of final list from random sampling

### 6. Shuffling
- Interleaves items to avoid obvious patterns
- Pattern: [recent, recent, historical, recent, random, random, historical, ...]

## API Endpoints

### GET /feed/personalised?stage=N

Returns personalized product feed for authenticated user.

**Query Parameters:**
- `stage` (number, default: 0) - Feed stage for pagination
- `limit` (number, default: 20, max: 50) - Number of products to return

**Response:**
```typescript
interface FeedBatchDto {
  batchMeta: {
    userId: number;
    generatedAt: string;
    stage: number;
    totalProcessed: number;
    totalSuccessful: number;
    totalFailed: number;
  };
  products: ProductItemDto[];
}
```

### GET /feed/health

Health check endpoint for the recommendation system.

## Cold Start Handling

Users are considered in "cold start" if:
- User age < 7 days AND
- Total interactions < 30

**Cold start adjustments:**
- Multiply all OnboardingProduct weights by 2
- Expand Random quota to 6 items

## Caching Strategy

- **Cache Key**: `feed:{userId}:{stage}`
- **TTL**: 10 minutes
- **Max Items**: 1000 cached feeds

## Performance Targets

- **Latency Budget**: ≤ 150ms (P95) for each 20-item batch
- **Signal Collection**: ≤ 10ms
- **Database Operations**: Transaction-safe and paginated

## Database Indexes

Recommended indexes for optimal performance:

```sql
-- Signal tables for fast collection
CREATE INDEX idx_like_user_created ON "Like" (userId, createdAt DESC);
CREATE INDEX idx_collection_user_created ON "Collection" (userId, createdAt DESC);
CREATE INDEX idx_trolley_user_created ON "ShoppingTrolley" (userId, createdAt DESC);
CREATE INDEX idx_viewing_user_created ON "ViewingHistory" (userId, viewedAt DESC);
CREATE INDEX idx_onboarding_user ON "OnboardingProduct" (userId);

-- Product filtering
CREATE INDEX idx_product_embedding_sex ON "ProductItem" (embedding, sex);
CREATE INDEX idx_product_category ON "ProductItem" (category);
```

## Testing

Run the test suite:

```bash
npm test -- recommendation.service.spec.ts
```

**Coverage Target**: ≥ 90% for the recommendation layer

## Dependencies

- **NestJS** - Framework
- **Prisma** - Database ORM
- **Qdrant** - Vector database
- **Cache Manager** - Redis caching
- **JWT Auth** - Authentication

## Environment Variables

Ensure these are configured:
- `DATABASE_URL` - PostgreSQL connection
- `QDRANT_URL` - Qdrant vector database URL
- `ML_URL` - ML service for embeddings

## Monitoring & Observability

The system includes comprehensive logging:
- Signal collection metrics
- Qdrant search performance
- Cache hit/miss ratios
- Error tracking

Consider adding OpenTelemetry tracing for `retrieveCandidatesFromQdrant` operations. 