export interface QdrantPayload {
  product_id: number;
  price: number;
  style?: string[];
  category?: string[];
  gender?: 'male' | 'female' | 'unisex';
  brand?: string[];
}

export interface QdrantPoint {
  id: number;
  vector: number[];
  payload: QdrantPayload;
}

export interface QdrantSearchResult {
  id: number;
  score: number;
}

export interface QdrantSearchResponse {
  results: QdrantSearchResult[];
  total_count?: number;
  execution_time?: number;
}

export interface QdrantInsertResponse {
  status: 'success' | 'error';
  message?: string;
  inserted_count?: number;
  failed_ids?: number[];
}

export interface QdrantDeleteResponse {
  status: 'success' | 'error';
  message?: string;
  deleted_count?: number;
}

export interface QdrantCollectionInfo {
  name: string;
  vectors_count: number;
  indexed_vectors_count: number;
  points_count: number;
  segments_count: number;
}

export interface QdrantFilter {
  must?: QdrantCondition[];
  should?: QdrantCondition[];
  must_not?: QdrantCondition[];
}

export interface QdrantCondition {
  key: string;
  match?: {
    value: string | number | boolean;
  };
  range?: {
    lt?: number;
    gt?: number;
    gte?: number;
    lte?: number;
  };
  geo_bounding_box?: {
    top_left: { lat: number; lon: number };
    bottom_right: { lat: number; lon: number };
  };
}
