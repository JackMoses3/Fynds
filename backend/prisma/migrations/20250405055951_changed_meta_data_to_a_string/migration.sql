/*
  Warnings:

  - Made the column `metaData` on table `ProductItem` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ProductItem" ALTER COLUMN "metaData" SET NOT NULL,
ALTER COLUMN "metaData" SET DATA TYPE TEXT;
