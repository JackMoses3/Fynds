import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import {
  CollectionType,
  Gender,
  InsertVectorDto,
  SearchVectorDto,
  DeleteVectorDto,
} from './dto/qdrant.dto';
import {
  QdrantSearchResponse,
  QdrantInsertResponse,
  QdrantDeleteResponse,
} from './models/qdrant.model';

import { ProductItemTransferDto } from '../product-item/dto/product-item.dto';
import { DatabaseService } from '../database/database.service';
import { SearchDto } from '../embedding-qdrant/dto/embedding-qdrant.dto';

@Injectable()
export class QdrantService {
  constructor(private readonly db: DatabaseService) {}
  private readonly logger = new Logger(QdrantService.name);
  private readonly mlServiceUrl = process.env.ML_URL + '/api/v1/vector';

  async insertVector(params: {
    collection: CollectionType;
    productId: number;
    vector: number[];
    style?: string[];
    price: number;
    category?: string[];
    gender?: Gender[];
    brand?: string[];
    retailer?: string[];
  }): Promise<QdrantInsertResponse> {
    const {
      collection,
      productId,
      vector,
      style,
      price,
      category,
      gender,
      brand,
      retailer,
    } = params;

    // Transform to match ML service expected format
    const payload = {
      collection: collection, // Collection names already match Qdrant collection names
      product_id: productId, // ML service expects product_id, not productId
      vector,
      price,
      style,
      category,
      gender,
      brand,
      retailer,
    };

    try {
      this.logger.log(
        `🔄 Sending payload to ML service: ${JSON.stringify(payload)}`,
      );

      const response = await fetch(`${this.mlServiceUrl}/insert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `ML Service error (${response.status}): ${errorText}`,
        );
        throw new HttpException(
          `ML Service error: ${response.statusText} - ${errorText}`,
          response.status,
        );
      }

      const result = await response.json();
      this.logger.log(
        `✅ Inserted vector for productId=${productId}: ${JSON.stringify(result)}`,
      );

      // Transform ML service response to expected format
      return {
        status: result.status === 'upserted' ? 'success' : result.status,
        inserted_count: 1,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `❌ Failed to insert vector for productId=${productId}: ${errorMessage}`,
      );

      // Re-throw HTTP exceptions as-is
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to insert vector',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async search(params: {
    collection: CollectionType;
    vector: number[];
    top_k?: number;
    style?: string[];
    price_lte?: number;
    category?: string[];
    gender?: Gender[];
    brand?: string[];
    retailer?: string[];
  }): Promise<QdrantSearchResponse> {
    const searchPayload: SearchVectorDto = {
      collection: params.collection,
      vector: params.vector,
      top_k: params.top_k || 10,
      style: params.style,
      price_lte: params.price_lte,
      category: params.category,
      gender: params.gender,
      brand: params.brand,
      retailer: params.retailer,
    };

    try {
      const response = await fetch(`${this.mlServiceUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchPayload),
      });

      if (!response.ok) {
        throw new HttpException(
          `ML Service error: ${response.statusText}`,
          response.status,
        );
      }

      const result = (await response.json()) as {
        results: Array<{ id: number; score: number }>;
      };
      this.logger.log(`Search completed with ${result.results.length} results`);

      return {
        results: result.results.map((item) => ({
          id: item.id,
          score: item.score,
        })),
        total_count: result.results.length,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to search vectors: ${errorMessage}`);
      throw new HttpException(
        'Failed to search vectors',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  // Search for products by productId
  // we need to grab the embedding (e.g., fb) for the given productId
  //
  async searchProduct(params: {
    productId: number;
    searchDto: SearchDto;
  }): Promise<ProductItemTransferDto[]> {
    // get the embedding form the given product
    const embeddingString = await this.db.productItem.findUnique({
      where: { id: params.productId },
      select: { embedding: true },
    });
    if (!embeddingString) {
      this.logger.warn(
        `No embedding found for productId=${params.productId}. Returning empty results.`,
      );
      return [];
    }
    // Parse embedding string to determine which collections to search
    const embeddingStr = embeddingString.embedding;
    if (!embeddingStr) {
      this.logger.warn(`Empty embedding for productId=${params.productId}`);
      return [];
    }

    const collections = [];
    if (embeddingStr.includes('f')) collections.push('IMAGE_FRONT_EMBEDDINGS');
    if (embeddingStr.includes('b')) collections.push('IMAGE_BACK_EMBEDDINGS');
    if (embeddingStr.includes('t')) collections.push('TEXT_EMBEDDINGS');

    if (collections.length === 0) {
      this.logger.warn(
        `No valid embedding types found in string: ${embeddingStr}`,
      );
      return [];
    }

    const allResults: Array<{ id: number; score: number; collection: string }> =
      [];

    // Search in each collection
    for (const collection of collections) {
      try {
        const searchProductPayload = {
          collection: collection,
          product_id: params.productId, // ML service expects product_id
          top_k: params.searchDto.top_k || 10,
          style: params.searchDto.style,
          price_lte: params.searchDto.price_lte,
          category: params.searchDto.category,
          gender: params.searchDto.gender,
          brand: params.searchDto.brand,
          retailer: params.searchDto.retailer,
        };

        const response = await fetch(`${this.mlServiceUrl}/search_product`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(searchProductPayload),
        });

        if (!response.ok) {
          this.logger.error(
            `ML Service error for collection ${collection}: ${response.statusText}`,
          );
          continue; // Skip this collection and try the next one
        }

        const result = (await response.json()) as {
          results: Array<{ id: number; score: number }>;
        };

        // Add collection info to results for debugging
        const resultsWithCollection = result.results.map((item) => ({
          ...item,
          collection: collection,
        }));

        allResults.push(...resultsWithCollection);
      } catch (error) {
        this.logger.error(
          `Error searching in collection ${collection}:`,
          error,
        );
        continue; // Continue with other collections
      }
    }

    if (allResults.length === 0) {
      return [];
    }

    // Remove duplicates and sort by score
    const uniqueResults: Array<{
      id: number;
      score: number;
      collection: string;
    }> = allResults.reduce(
      (acc, current) => {
        const existingIndex = acc.findIndex((item) => item.id === current.id);
        if (existingIndex === -1) {
          acc.push(current);
        } else {
          // Keep the one with higher score
          if (current.score > acc[existingIndex].score) {
            acc[existingIndex] = current;
          }
        }
        return acc;
      },
      [] as Array<{ id: number; score: number; collection: string }>,
    );

    // Sort by score (highest first) and limit results
    uniqueResults.sort((a, b) => b.score - a.score);
    const limitedResults = uniqueResults.slice(0, params.searchDto.top_k || 10);

    this.logger.log(
      `Product search completed with ${limitedResults.length} unique results`,
    );

    // Fetch product details from database
    const productIds = limitedResults.map((item) => item.id);
    const products = await this.db.productItem.findMany({
      where: { id: { in: productIds } },
      include: { productImages: true },
    });

    // Map to ProductItemTransferDto format
    return products.map((product) => ({
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category || '',
      price: product.price,
      retailer: product.retailer,
      style: [], // TODO: Add styles if needed
      images: product.productImages.map((img) => ({
        id: img.id,
        imageUrl: img.imageUrl,
        frontFacing: img.frontFacing,
      })),
      url: product.url,
    }));
  }

  async deleteVector(params: {
    collection: CollectionType;
    productId: number;
  }): Promise<QdrantDeleteResponse> {
    // Transform to match ML service expected format
    const deletePayload = {
      collection: params.collection,
      product_id: params.productId, // ML service expects product_id, not productId
    };

    try {
      const response = await fetch(`${this.mlServiceUrl}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deletePayload),
      });

      if (!response.ok) {
        throw new HttpException(
          `ML Service error: ${response.statusText}`,
          response.status,
        );
      }

      this.logger.log(`Deleted vector for productId=${params.productId}`);

      return {
        status: 'success',
        deleted_count: 1,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete vector: ${errorMessage}`);
      throw new HttpException(
        'Failed to delete vector',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Batch upsert vectors into Qdrant for a given collection.
   * @param collection - Qdrant collection name
   * @param points - Array of {id, vector, payload}
   */
  async upsertPointsBulk(
    collection: CollectionType,
    points: Array<{ id: number; vector: number[]; payload: any }>,
  ): Promise<{ status: string; count: number }> {
    // Use QDRANT_URL, not ML_URL
    const url = `${process.env.QDRANT_URL}/collections/${collection}/points`;
    const payload = {
      points: points.map((p) => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload,
      })),
    };

    try {
      this.logger.log(
        `🔄 [Qdrant] Bulk upsert: ${points.length} points to ${collection}`,
      );
      const response = await fetch(url, {
        method: 'PUT', // Qdrant expects PUT for upsert
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `[Qdrant] Bulk upsert error (${response.status}): ${errorText}`,
        );
        throw new HttpException(
          `Qdrant bulk upsert error: ${response.statusText} - ${errorText}`,
          response.status,
        );
      }

      const result = await response.json();
      this.logger.log(
        `✅ [Qdrant] Bulk upserted ${points.length} points to ${collection}`,
      );
      return { status: result.status ?? 'success', count: points.length };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `[Qdrant] Bulk upsert failed for ${collection}: ${errorMessage}`,
      );
      throw new HttpException(
        'Failed to upsert points in bulk',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
