export class CreateViewingDto {
  productId: number;
  scrollLength?: number; // Number of horizontal swipes
  scrollDepth?: number; // % of horizontal swipes (0-100)
  scrollTime?: number; // Time spent on product (seconds)
}
