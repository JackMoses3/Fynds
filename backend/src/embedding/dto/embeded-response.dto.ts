export interface EmbedResponseDto {
  productId: number;
  frontEmbedding: number[] | null;
  backEmbedding: number[] | null;
  textEmbedding: number[] | null;
}
