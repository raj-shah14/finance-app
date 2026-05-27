-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "merchantPatterns" TEXT[] DEFAULT ARRAY[]::TEXT[];
