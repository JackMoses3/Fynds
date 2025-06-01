export interface ImageDTO {
  id: number;
  url: string;
}

export interface EmbedRequestDTO {
  productId: number;
  name: string;
  images: ImageDTO[];
}
