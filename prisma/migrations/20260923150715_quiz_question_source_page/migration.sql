-- AlterTable
ALTER TABLE "quiz_questions" ADD COLUMN     "sourcePageId" TEXT;

-- CreateIndex
CREATE INDEX "quiz_questions_sourcePageId_idx" ON "quiz_questions"("sourcePageId");

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_sourcePageId_fkey" FOREIGN KEY ("sourcePageId") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
