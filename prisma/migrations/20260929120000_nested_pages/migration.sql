-- Notion-style nested pages: optional parent page. Additive only — existing pages keep
-- parentId = NULL and stay top-level in their folder.

-- AlterTable
ALTER TABLE "pages" ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "pages_parentId_idx" ON "pages"("parentId");

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
