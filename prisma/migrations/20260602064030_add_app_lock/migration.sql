-- AlterTable
ALTER TABLE "User" ADD COLUMN     "appLockEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "appLockIdleMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "pinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pinHash" TEXT,
ADD COLUMN     "pinLockedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BiometricCredential" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deviceLabel" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "BiometricCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BiometricCredential_credentialId_key" ON "BiometricCredential"("credentialId");

-- CreateIndex
CREATE INDEX "BiometricCredential_userId_idx" ON "BiometricCredential"("userId");

-- AddForeignKey
ALTER TABLE "BiometricCredential" ADD CONSTRAINT "BiometricCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
