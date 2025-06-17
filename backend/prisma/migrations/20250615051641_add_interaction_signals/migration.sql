-- AlterTable
ALTER TABLE "User" ADD COLUMN     "previousSearches" TEXT[];

-- AlterTable
ALTER TABLE "ViewingHistory" ADD COLUMN     "scrollDepth" DOUBLE PRECISION,
ADD COLUMN     "scrollLength" INTEGER,
ADD COLUMN     "viewUntil" TIMESTAMP(3);
