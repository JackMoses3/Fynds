export interface EmbedResponseDTO {
    productId: number;
    frontEmbedding: number[] | null; // 512-long float32 → number[]
    backEmbedding: number[] | null;
    textEmbedding: number[];        // never null
}