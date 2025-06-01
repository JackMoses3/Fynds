import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import {
  CollectionType,
  Gender,
  InsertVectorDto,
  SearchVectorDto,
  SearchProductDto,
  DeleteVectorDto,
} from './dto/qdrant.dto';
import {
  QdrantSearchResponse,
  QdrantInsertResponse,
  QdrantDeleteResponse,
} from './models/qdrant.model';

@Injectable()
export class QdrantService {
  private readonly logger = new Logger(QdrantService.name);
  private readonly mlServiceUrl =
    process.env.ML_SERVICE_URL || 'http://localhost:8000';

  async insertVector(params: {
    collection: CollectionType;
    product_id: number;
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
      product_id,
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
      product_id,
      vector,
      price,
      style,
      category,
      gender,
      brand,
      retailer,
    };

    try {
      const response = await fetch(
        `${this.mlServiceUrl}/api/v1/vector/insert`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        throw new HttpException(
          `ML Service error: ${response.statusText}`,
          response.status,
        );
      }

      this.logger.log(`Inserted vector for product_id=${product_id}`);
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
      const response = await fetch(
        `${this.mlServiceUrl}/api/v1/vector/search`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(searchPayload),
        },
      );

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

  async searchProduct(params: {
    collection: CollectionType;
    product_id: number;
    top_k?: number;
    style?: string[];
    price_lte?: number;
    category?: string[];
    gender?: Gender[];
    brand?: string[];
    retailer?: string[];
  }): Promise<QdrantSearchResponse> {
    const searchProductPayload: SearchProductDto = {
      collection: params.collection,
      product_id: params.product_id,
      top_k: params.top_k || 10,
      style: params.style,
      price_lte: params.price_lte,
      category: params.category,
      gender: params.gender,
      brand: params.brand,
      retailer: params.retailer,
    };

    try {
      const response = await fetch(
        `${this.mlServiceUrl}/api/v1/vector/search_product`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(searchProductPayload),
        },
      );

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
    product_id: number;
  }): Promise<QdrantDeleteResponse> {
    const deletePayload: DeleteVectorDto = {
      collection: params.collection,
      product_id: params.product_id,
    };

    try {
      const response = await fetch(
        `${this.mlServiceUrl}/api/v1/vector/delete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(deletePayload),
        },
      );

      if (!response.ok) {
        throw new HttpException(
          `ML Service error: ${response.statusText}`,
          response.status,
        );
      }

      this.logger.log(`Deleted vector for product_id=${params.product_id}`);

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
