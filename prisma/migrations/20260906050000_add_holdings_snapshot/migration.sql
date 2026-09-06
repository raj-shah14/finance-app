-- CreateTable
CREATE TABLE "HoldingsSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HoldingsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HoldingsSnapshot_userId_kind_date_idx" ON "HoldingsSnapshot"("userId", "kind", "date");

-- CreateIndex
CREATE UNIQUE INDEX "HoldingsSnapshot_userId_kind_date_key" ON "HoldingsSnapshot"("userId", "kind", "date");

-- AddForeignKey
ALTER TABLE "HoldingsSnapshot" ADD CONSTRAINT "HoldingsSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
