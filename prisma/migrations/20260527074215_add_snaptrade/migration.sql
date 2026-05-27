-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'plaid',
ADD COLUMN     "snapTradeItemId" TEXT,
ALTER COLUMN "plaidItemId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "SnapTradeItem" (
    "id" TEXT NOT NULL,
    "snapTradeUserId" TEXT NOT NULL,
    "userSecretEncrypted" TEXT NOT NULL,
    "authorizationId" TEXT,
    "brokerageName" TEXT,
    "brokerageSlug" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SnapTradeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SnapTradeItem_authorizationId_key" ON "SnapTradeItem"("authorizationId");

-- CreateIndex
CREATE INDEX "SnapTradeItem_userId_idx" ON "SnapTradeItem"("userId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_snapTradeItemId_fkey" FOREIGN KEY ("snapTradeItemId") REFERENCES "SnapTradeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapTradeItem" ADD CONSTRAINT "SnapTradeItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
