-- Question bank: questions written ahead of time per page. Additive only.

-- AlterTable
ALTER TABLE "pages" ADD COLUMN     "bankAttemptAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "bank_questions" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "questionText" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "explanation" TEXT,
    "contentHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_questions_pageId_difficulty_idx" ON "bank_questions"("pageId", "difficulty");

-- AddForeignKey
ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
