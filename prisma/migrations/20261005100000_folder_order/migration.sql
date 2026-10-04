-- AlterTable
ALTER TABLE "users" ADD COLUMN     "folderOrder" TEXT[] DEFAULT ARRAY[]::TEXT[];

