-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "interestRate" DOUBLE PRECISION,
ADD COLUMN     "merchantPatterns" TEXT[] DEFAULT ARRAY[]::TEXT[];
