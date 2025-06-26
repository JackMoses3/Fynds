/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `Style` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Style" DROP COLUMN "imageUrl",
ADD COLUMN     "imageUrlFemale" TEXT,
ADD COLUMN     "imageUrlMale" TEXT;
