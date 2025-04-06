/*
  Warnings:

  - You are about to drop the column `backEmbeddingID` on the `ProductItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ProductItem" DROP COLUMN "backEmbeddingID",
ADD COLUMN     "backEmbeddingId" INTEGER;
