/*
  Warnings:

  - Added the required column `category` to the `ProductItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ProductItem" ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "subCategory" TEXT,
ADD COLUMN     "textEmbeddingId" BIGINT;
