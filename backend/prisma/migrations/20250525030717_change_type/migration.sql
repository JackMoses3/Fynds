/*
  Warnings:

  - You are about to drop the column `stanrdardPrice` on the `ProductItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ProductItem" DROP COLUMN "stanrdardPrice",
ADD COLUMN     "standardPrice" DOUBLE PRECISION;
