-- CreateTable
CREATE TABLE "OnboardingProduct" (
    "id" SERIAL NOT NULL,
    "productItemId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingProduct_productItemId_userId_key" ON "OnboardingProduct"("productItemId", "userId");

-- AddForeignKey
ALTER TABLE "OnboardingProduct" ADD CONSTRAINT "OnboardingProduct_productItemId_fkey" FOREIGN KEY ("productItemId") REFERENCES "ProductItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingProduct" ADD CONSTRAINT "OnboardingProduct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
