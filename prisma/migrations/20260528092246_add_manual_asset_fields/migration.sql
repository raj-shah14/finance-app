-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "purchaseDate" TIMESTAMP(3),
ADD COLUMN     "purchasePrice" DOUBLE PRECISION;
