/*
  Warnings:

  - You are about to drop the column `embeddignId` on the `ProductItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ProductItem" DROP COLUMN "embeddignId",
ADD COLUMN     "embedding" TEXT;
