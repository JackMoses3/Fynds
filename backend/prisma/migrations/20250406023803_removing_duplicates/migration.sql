/*
  Warnings:

  - A unique constraint covering the columns `[url]` on the table `ProductItem` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ProductItem_url_key" ON "ProductItem"("url");
