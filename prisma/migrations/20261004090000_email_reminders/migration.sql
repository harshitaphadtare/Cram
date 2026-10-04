-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailPlan" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailReminders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailWeekly" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_logs_userId_kind_sentAt_idx" ON "email_logs"("userId", "kind", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_logs_userId_kind_day_key" ON "email_logs"("userId", "kind", "day");

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Only the server (which bypasses RLS) touches this table; keep it closed to Supabase's public API.
ALTER TABLE "email_logs" ENABLE ROW LEVEL SECURITY;
