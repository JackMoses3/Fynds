export interface EmbedResponseDto {
  frontEmbedding: number[] | null;
  backEmbedding: number[] | null;
  textEmbedding: number[] | null;
  frontFacingImages: boolean[];
}
