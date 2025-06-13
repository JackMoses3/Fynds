/* eslint-disable */
import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { CollectionType, Gender, SearchVectorDto } from './dto/qdrant.dto';
import {
  QdrantSearchResponse,
  QdrantInsertResponse,
  QdrantDeleteResponse,
} from './models/qdrant.model';

import { DatabaseService } from '../database/database.service';
import { SearchDto } from '../embedding-qdrant/dto/embedding-qdrant.dto';

@Injectable()
export class QdrantService {
  constructor(private readonly db: DatabaseService) {}
  private readonly logger = new Logger(QdrantService.name);
  // The mlServiceUrl is used by other methods like insertVector; not used here.
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
  /**
   * Searches for similar products by retrieving the target product’s embedding,
   * and then querying Qdrant’s search API on each collection (TEXT, IMAGE_BACK, IMAGE_FRONT).
   * Returns an array of objects with the product id and distance.
   */
  async searchProduct(params: {
    productId: number;
    searchDto: SearchDto;
  }): Promise<{ id: number; distance: number }[]> {
    this.logger.debug(
      `Starting searchProduct for productId=${params.productId}`,
    );
    // Define the collections to search in.
    const collections = [
      'IMAGE_FRONT_EMBEDDINGS',
      'IMAGE_BACK_EMBEDDINGS',
      'TEXT_EMBEDDINGS',
    ];
    const allResults: Array<{ id: number; score: number; collection: string }> =
      [];
    const searchLimit = params.searchDto.top_k || 20; // Request 20 from each collection

    // Loop through each collection.
    for (const collection of collections) {
      let targetVector: number[];
      this.logger.debug(`Searching in collection: ${collection}`);

      // 1. fetches a point (vector) from qdrant. Vector is fetches if productId
      const getUrl = `${process.env.QDRANT_URL}/collections/${collection}/points`;
      const getPayload = {
        ids: [params.productId],
        with_vector: true,
        with_payload: false,
      };
      this.logger.debug(`GET URL: ${getUrl}`);
      this.logger.debug(`GET Payload: ${JSON.stringify(getPayload)}`);

      // try fetch the embedding from qdrant getResp is the response when fetched, including embedding of productId
      try {
        const getResp = await fetch(getUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(getPayload),
        });
        this.logger.debug(`GET Response Status: ${getResp.status}`);

        if (!getResp.ok) {
          this.logger.warn(
            `Failed to fetch embedding from ${collection} for productId=${params.productId}: ${getResp.statusText}`,
          );
          continue;
        }

        const getData = await getResp.json();
        this.logger.debug(
          `GET Data from ${collection}: ${JSON.stringify(getData)}`,
        );

        // Adjusted: Qdrant returns the points array directly in getData.result.
        if (
          !getData.result ||
          !Array.isArray(getData.result) ||
          getData.result.length === 0
        ) {
          this.logger.warn(
            `No embedding found in ${collection} for productId=${params.productId}`,
          );
          continue;
        }
        // Get the vector from the first returned point.
        targetVector = getData.result[0].vector;
        this.logger.debug(
          `Fetched vector in ${collection}: ${JSON.stringify(targetVector)}`,
        );

        // Check that targetVector is a valid numeric array.
        if (!targetVector || !Array.isArray(targetVector)) {
          this.logger.warn(
            `Invalid or missing vector data in ${collection} for productId=${params.productId}: ${targetVector}`,
          );
          continue;
        }
      } catch (error) {
        this.logger.error(`Error fetching embedding in ${collection}:`, error);
        continue;
      }

      // 2. Use the fetched vector to search for similar products in this collection.
      try {
        const searchUrl = `${process.env.QDRANT_URL}/collections/${collection}/points/search`;
        const searchPayload = {
          vector: targetVector,
          limit: params.searchDto.top_k || 10,
          score_threshold: 0, // Allow even low-similarity matches
        };
        this.logger.debug(`Search URL: ${searchUrl}`);
        this.logger.debug(`Search Payload: ${JSON.stringify(searchPayload)}`);

        const searchResp = await fetch(searchUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(searchPayload),
        });

        this.logger.debug(
          `Search Response Status in ${collection}: ${searchResp.status}`,
        );

        if (!searchResp.ok) {
          this.logger.error(
            `Qdrant search error for collection ${collection}: ${searchResp.statusText}`,
          );
          continue;
        }

        const searchResult = await searchResp.json();
        this.logger.debug(
          `Search Result from ${collection}: ${JSON.stringify(searchResult)}`,
        );
        // Expected response shape: { result: { hits: Array<{ id: number; score: number, ... }> } }
        const hits = Array.isArray(searchResult.result)
          ? searchResult.result
          : searchResult.result.hits;
        if (Array.isArray(hits)) {
          const results = hits
            .filter((r: any) => r.id !== params.productId) // Exclude the queried product.
            .map((r: any) => ({ id: r.id, score: r.score, collection }));
          this.logger.debug(
            `Results from ${collection}: ${JSON.stringify(results)}`,
          );
          allResults.push(...results);
        }
      } catch (error) {
        this.logger.error(
          `Error searching in collection ${collection}:`,
          error,
        );
        continue;
      }
    }

    if (allResults.length === 0) {
      this.logger.debug('No similar products found in any collection.');
      return [];
    }

    // 3. Deduplicate results: keep one entry per product ID with the highest score.
    const uniqueResults = allResults.reduce(
      (acc: any[], current) => {
        const existing = acc.find((item) => item.id === current.id);
        if (!existing) {
          acc.push(current);
        } else if (current.score > existing.score) {
          existing.score = current.score;
        }
        return acc;
      },
      [] as Array<{ id: number; score: number; collection: string }>,
    );
    this.logger.debug(`Unique Results: ${JSON.stringify(uniqueResults)}`);

    // 4. Sort by descending score and limit the results.
    uniqueResults.sort((a, b) => b.score - a.score);
    const limitedResults = uniqueResults.slice(0, params.searchDto.top_k || 10);
    this.logger.debug(`Limited Results: ${JSON.stringify(limitedResults)}`);

    // 5. Fetch URLs from the database for each product id.
    const productIds = limitedResults.map((r) => r.id);
    const products = await this.db.productItem.findMany({
      where: { id: { in: productIds } },
      select: { id: true, url: true },
    });
    const idToUrl = Object.fromEntries(products.map((p) => [p.id, p.url]));

    // 6. Return objects with id, url, and distance.
    const finalResults = limitedResults.map((r) => ({
      id: r.id,
      url: idToUrl[r.id] || null,
      distance: r.score,
    }));
    this.logger.debug(`Final Results: ${JSON.stringify(finalResults)}`);
    return finalResults;
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

  async addStyle(
    style_id: number,
    style_name: string,
    vector: number[],
  ): Promise<QdrantInsertResponse> {
    const payload = {
      style_id: style_id,
      style_name: style_name,
      vector: vector,
    };

    try {
      this.logger.log(
        `🔄 Adding style to STYLE_EMBEDDINGS: ${JSON.stringify({
          style_id,
          style_name,
          vector_length: vector.length,
        })}`,
      );

      const response = await fetch(`${this.mlServiceUrl}/insert_style`, {
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
        `✅ Added style ${style_name} (ID: ${style_id}): ${JSON.stringify(result)}`,
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
        `❌ Failed to add style ${style_name} (ID: ${style_id}): ${errorMessage}`,
      );

      // Re-throw HTTP exceptions as-is
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to add style',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Classify a product's style using multimodal approach (text + images)
   * Returns style classifications with similarity scores
   */
  async classifyProductStyle(params: {
    productId: number;
    topK?: number;
    minConfidence?: number;
  }): Promise<{
    product_id: number;
    found_in_collections: string[];
    collections_used: number;
    styles: Array<{
      style_id: number;
      similarity_score: number;
      collections_count: number;
    }>;
  }> {
    const { productId, topK = 5, minConfidence = 0.0 } = params;

    const payload = {
      product_id: productId,
      top_k: topK,
      min_confidence: minConfidence,
    };

    try {
      this.logger.log(
        `🔍 Classifying product style for productId=${productId} (topK=${topK}, minConfidence=${minConfidence})`,
      );

      const response = await fetch(
        `${this.mlServiceUrl}/classify_multimodal_style`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

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
        `✅ Style classification for productId=${productId}: ${result.styles?.length || 0} styles found using ${result.collections_used || 0} collections`,
      );

      // Log the top style if found
      if (result.styles && result.styles.length > 0) {
        const topStyle = result.styles[0];
        this.logger.log(
          `🎯 Top style for productId=${productId}: style_id=${topStyle.style_id}, score=${topStyle.similarity_score}`,
        );
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `❌ Failed to classify product style for productId=${productId}: ${errorMessage}`,
      );

      // Re-throw HTTP exceptions as-is
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to classify product style',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get the best matching style for a product (convenience method)
   * Returns only the top style or null if none found
   */
  async getBestProductStyle(
    productId: number,
    minConfidence: number = 0.3,
  ): Promise<{
    style_id: number;
    similarity_score: number;
    collections_count: number;
  } | null> {
    try {
      const result = await this.classifyProductStyle({
        productId,
        topK: 1,
        minConfidence,
      });

      if (result.styles && result.styles.length > 0) {
        return result.styles[0];
      }

      return null;
    } catch (error) {
      this.logger.error(
        `Failed to get best style for productId=${productId}: ${error}`,
      );
      return null;
    }
  }
}
