export class StyleResult {
  style_id: number;
  style_name: string;
  similarity_score: number;
}

export class ModalityResult {
  collection: string;
  styles: StyleResult[];
  count: number;
}

export class MultimodalStyleClassificationRequest {
  productId: number;
  topK?: number = 5;
  minConfidence?: number = 0.0;
}

export class MultimodalStyleClassificationResponse {
  product_id: number;
  found_in_collections: string[];
  total_modalities: number;
  total_unique_styles: number;
  top_k_per_modality: number;
  min_confidence: number;
  results: {
    text_styles?: ModalityResult;
    image_front_styles?: ModalityResult;
    image_back_styles?: ModalityResult;
  };
}

export class MultimodalStyleBatchRequest {
  productIds: number[];
  topK?: number = 5;
  minConfidence?: number = 0.0;
}

export class MultimodalStyleBatchError {
  productId: number;
  error: string;
}

export class MultimodalStyleBatchResponse {
  successful: number;
  failed: number;
  results: MultimodalStyleClassificationResponse[];
  errors: MultimodalStyleBatchError[];
}
