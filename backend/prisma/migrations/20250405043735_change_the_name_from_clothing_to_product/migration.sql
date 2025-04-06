/*
  Warnings:

  - You are about to drop the `ClothingImage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ClothingItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ClothingImage" DROP CONSTRAINT "ClothingImage_clothingItemId_fkey";

-- DropTable
DROP TABLE "ClothingImage";

-- DropTable
DROP TABLE "ClothingItem";

-- CreateTable
CREATE TABLE "ProductItem" (
    "id" SERIAL NOT NULL,
    "sex" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metaData" JSONB,
    "retailer" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "frontEmbeddingId" INTEGER,
    "backEmbeddingID" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" SERIAL NOT NULL,
    "productItemId" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "frontFacing" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productItemId_fkey" FOREIGN KEY ("productItemId") REFERENCES "ProductItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
