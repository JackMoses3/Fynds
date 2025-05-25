/*
  Warnings:

  - A unique constraint covering the columns `[retailer,storeId]` on the table `ProductItem` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ProductItem" ADD COLUMN     "lastModified" TIMESTAMP(3),
ADD COLUMN     "sale" BOOLEAN DEFAULT false,
ADD COLUMN     "siteDataConfigId" INTEGER,
ADD COLUMN     "standardPrice" DOUBLE PRECISION,
ADD COLUMN     "storeId" BIGINT;

-- CreateTable
CREATE TABLE "SiteDataConfig" (
    "id" SERIAL NOT NULL,
    "domain" TEXT NOT NULL,
    "retailerName" TEXT NOT NULL,
    "siteMapUrl" TEXT[],
    "ecommercePlatform" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCrawled" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteDataConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Look" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "siteDataConfigId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Look_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductItemLook" (
    "id" SERIAL NOT NULL,
    "productItemId" INTEGER NOT NULL,
    "lookId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductItemLook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemVideo" (
    "id" SERIAL NOT NULL,
    "productItemId" INTEGER NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteDataConfig_domain_key" ON "SiteDataConfig"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "ProductItemLook_productItemId_lookId_key" ON "ProductItemLook"("productItemId", "lookId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductItem_retailer_storeId_key" ON "ProductItem"("retailer", "storeId");

-- AddForeignKey
ALTER TABLE "ProductItem" ADD CONSTRAINT "ProductItem_siteDataConfigId_fkey" FOREIGN KEY ("siteDataConfigId") REFERENCES "SiteDataConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Look" ADD CONSTRAINT "Look_siteDataConfigId_fkey" FOREIGN KEY ("siteDataConfigId") REFERENCES "SiteDataConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductItemLook" ADD CONSTRAINT "ProductItemLook_lookId_fkey" FOREIGN KEY ("lookId") REFERENCES "Look"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductItemLook" ADD CONSTRAINT "ProductItemLook_productItemId_fkey" FOREIGN KEY ("productItemId") REFERENCES "ProductItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVideo" ADD CONSTRAINT "ItemVideo_productItemId_fkey" FOREIGN KEY ("productItemId") REFERENCES "ProductItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
