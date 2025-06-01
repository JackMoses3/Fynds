/*
  Warnings:

  - You are about to drop the column `standardPrice` on the `ProductItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ProductItem" DROP COLUMN "standardPrice",
ADD COLUMN     "stanrdardPrice" DOUBLE PRECISION;
