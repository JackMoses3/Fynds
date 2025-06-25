-- CreateTable
CREATE TABLE "ProductScore" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "productItemId" INTEGER NOT NULL,
    "score" DOUBLE PRECISION,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductScore_userId_productItemId_created_key" ON "ProductScore"("userId", "productItemId", "created");

-- AddForeignKey
ALTER TABLE "ProductScore" ADD CONSTRAINT "ProductScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductScore" ADD CONSTRAINT "ProductScore_productItemId_fkey" FOREIGN KEY ("productItemId") REFERENCES "ProductItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
