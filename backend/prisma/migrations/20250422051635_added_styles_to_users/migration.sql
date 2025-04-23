-- CreateTable
CREATE TABLE "UserStyle" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "styleId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStyle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserStyle_userId_styleId_key" ON "UserStyle"("userId", "styleId");

-- AddForeignKey
ALTER TABLE "UserStyle" ADD CONSTRAINT "UserStyle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStyle" ADD CONSTRAINT "UserStyle_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "Style"("id") ON DELETE CASCADE ON UPDATE CASCADE;
