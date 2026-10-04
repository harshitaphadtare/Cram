-- CreateTable
CREATE TABLE "folder_study_time" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "folder_study_time_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "folder_study_time_userId_date_idx" ON "folder_study_time"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "folder_study_time_userId_folderId_date_key" ON "folder_study_time"("userId", "folderId", "date");

-- AddForeignKey
ALTER TABLE "folder_study_time" ADD CONSTRAINT "folder_study_time_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_study_time" ADD CONSTRAINT "folder_study_time_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Server-only table; keep it closed to Supabase's public API like the rest.
ALTER TABLE "folder_study_time" ENABLE ROW LEVEL SECURITY;
