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

import { ProductItemTransferDto } from 'src/product-item/dto/product-item.dto';
import { DatabaseService } from 'src/database/database.service';
import { SearchDto } from 'src/embedding-qdrant/dto/embedding-qdrant.dto';

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

    const payload: InsertVectorDto = {
      collection,
      productId,
      vector,
      price,
      style,
      category,
      gender,
      brand,
      retailer,
    };

    try {
      const response = await fetch(`${this.mlServiceUrl}/insert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new HttpException(
          `ML Service error: ${response.statusText}`,
          response.status,
        );
      }

      this.logger.log(`Inserted vector for productId=${productId}`);
      return {
        status: 'success',
        inserted_count: 1,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to insert vector: ${errorMessage}`);
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
    // check each character in the string and get the list of similar products and their scores
    // repeat this try for f b t if needed
    try {
      const response = await fetch(`${this.mlServiceUrl}/search_product`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchProductPayload),
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
      this.logger.log(
        `Product search completed with ${result.results.length} results`,
      );

      // Going to want to use a helper function potentially to get the best products based off weights(e.g. based on whether they liked front or back image)
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
      this.logger.error(`Failed to search product: ${errorMessage}`);
      throw new HttpException(
        'Failed to search product',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteVector(params: {
    collection: CollectionType;
    productId: number;
  }): Promise<QdrantDeleteResponse> {
    const deletePayload: DeleteVectorDto = {
      collection: params.collection,
      productId: params.productId,
    };

    try {
      const response = await fetch(`${this.mlServiceUrl}/delete`, {
        method: 'DELETE',
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
}
