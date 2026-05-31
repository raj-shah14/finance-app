-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "escrowMonthly" DOUBLE PRECISION,
ADD COLUMN     "extraPrincipalMonthly" DOUBLE PRECISION,
ADD COLUMN     "hoaMonthly" DOUBLE PRECISION,
ADD COLUMN     "monthlyPayment" DOUBLE PRECISION,
ADD COLUMN     "termMonths" INTEGER;
