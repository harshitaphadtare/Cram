-- AlterTable
ALTER TABLE "streak_logs" ADD COLUMN     "frozen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "goalMet" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "xp" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dailyGoalMin" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "lastEditAt" TIMESTAMP(3),
ADD COLUMN     "lastFreezeGrantAt" TIMESTAMP(3),
ADD COLUMN     "showOnLeaderboard" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "streakFreezes" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "xp" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seen" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_reviews" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "mastery" INTEGER NOT NULL DEFAULT 0,
    "intervalDays" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "lastReviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_userId_key_key" ON "user_achievements"("userId", "key");

-- CreateIndex
CREATE INDEX "page_reviews_userId_dueAt_idx" ON "page_reviews"("userId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "page_reviews_userId_pageId_key" ON "page_reviews"("userId", "pageId");

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_reviews" ADD CONSTRAINT "page_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_reviews" ADD CONSTRAINT "page_reviews_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: credit existing study history with XP (1 per focus minute, 5 per correct quiz answer)
-- so current users don't start from zero.
UPDATE "users" u SET "xp" =
  COALESCE((SELECT SUM(p."durationMin") FROM "pomodoro_sessions" p
            WHERE p."userId" = u."id" AND p."type" = 'WORK' AND p."completed"), 0)
  + COALESCE((SELECT SUM(q."correctCount") * 5 FROM "quizzes" q
              WHERE q."userId" = u."id" AND q."status" = 'completed'), 0);
