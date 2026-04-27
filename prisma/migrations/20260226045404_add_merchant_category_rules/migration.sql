-- CreateTable
CREATE TABLE "MerchantCategoryRule" (
    "id" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantCategoryRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MerchantCategoryRule_householdId_idx" ON "MerchantCategoryRule"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantCategoryRule_merchantName_householdId_key" ON "MerchantCategoryRule"("merchantName", "householdId");

-- AddForeignKey
ALTER TABLE "MerchantCategoryRule" ADD CONSTRAINT "MerchantCategoryRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
