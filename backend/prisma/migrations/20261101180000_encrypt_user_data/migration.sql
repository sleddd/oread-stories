-- AlterTable
ALTER TABLE "memory_embedding" ADD COLUMN     "sealedVector" JSONB,
ALTER COLUMN "vector" SET DEFAULT ARRAY[]::DOUBLE PRECISION[];

-- CreateTable
CREATE TABLE "user_vault" (
    "userId" TEXT NOT NULL,
    "passwordWrap" JSONB NOT NULL,
    "recoveryWrap" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_vault_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "session_key" (
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sealedDataKey" JSONB NOT NULL,
    "pendingRecoveryCode" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_key_pkey" PRIMARY KEY ("sessionId")
);

-- CreateIndex
CREATE INDEX "session_key_userId_idx" ON "session_key"("userId");

-- AddForeignKey
ALTER TABLE "user_vault" ADD CONSTRAINT "user_vault_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_key" ADD CONSTRAINT "session_key_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

