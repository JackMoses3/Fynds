/*
  Warnings:

  - You are about to drop the column `back_embedding` on the `ClothingItem` table. All the data in the column will be lost.
  - You are about to drop the column `front_embedding` on the `ClothingItem` table. All the data in the column will be lost.
  - Added the required column `sex` to the `ClothingItem` table without a default value. This is not possible if the table is not empty.
  - Made the column `price` on table `ClothingItem` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ClothingImage" ALTER COLUMN "frontFacing" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ClothingItem" DROP COLUMN "back_embedding",
DROP COLUMN "front_embedding",
ADD COLUMN     "backEmbeddingID" INTEGER,
ADD COLUMN     "frontEmbeddingId" INTEGER,
ADD COLUMN     "sex" TEXT NOT NULL,
ALTER COLUMN "price" SET NOT NULL;
