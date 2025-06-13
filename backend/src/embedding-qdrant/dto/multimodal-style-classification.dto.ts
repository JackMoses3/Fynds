export class StyleAnalysisConfig {
  textWeight: number = 0.6; // Weight for text-based classification
  frontImageWeight: number = 0.3; // Weight for front image classification
  backImageWeight: number = 0.1; // Weight for back image classification
  updateThreshold: number = 0.3; // Minimum score to update product styles
  maxStyles: number = 4; // Maximum styles to assign per product
  requireMinModalities: number = 1; // Require at least 2 modalities for update
}

export class WeightedStyleScore {
  style_id: number;
  style_name: string;
  weighted_score: number;
  modality_scores: {
    text?: number;
    front_image?: number;
    back_image?: number;
  };
  modalities_count: number;
  confidence: 'high' | 'medium' | 'low';
}

export class StyleAnalysisResult {
  product_id: number;
  recommended_styles: WeightedStyleScore[];
  styles_to_add: number[];
  styles_to_remove: number[];
  current_styles: number[];
  analysis_summary: {
    total_candidates: number;
    above_threshold: number;
    modalities_analyzed: number;
    confidence_distribution: {
      high: number;
      medium: number;
      low: number;
    };
  };
}
