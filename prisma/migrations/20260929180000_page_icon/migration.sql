-- Optional emoji icon per page. Additive only — existing pages keep the default icon (NULL).

-- AlterTable
ALTER TABLE "pages" ADD COLUMN     "icon" TEXT;
