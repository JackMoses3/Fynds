/*
  Warnings:

  - You are about to drop the column `embedding` on the `ClothingItem` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `ClothingItem` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `ClothingItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ClothingItem" DROP COLUMN "embedding",
DROP COLUMN "imageUrl",
ADD COLUMN     "back_embedding" JSONB,
ADD COLUMN     "front_embedding" JSONB,
ADD COLUMN     "metaData" JSONB,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "ClothingImage" (
    "id" SERIAL NOT NULL,
    "clothingItemId" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "frontFacing" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClothingImage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ClothingImage" ADD CONSTRAINT "ClothingImage_clothingItemId_fkey" FOREIGN KEY ("clothingItemId") REFERENCES "ClothingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
