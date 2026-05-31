-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "currentBalanceAsOf" TIMESTAMP(3),
ADD COLUMN     "currentBalanceOverride" DOUBLE PRECISION;
