-- Close every app table to Supabase's public Data API (PostgREST).
--
-- The anon key ships to every browser, and these tables were readable with it. The app never
-- reads data through Supabase's API: Prisma connects as the postgres role, which bypasses RLS,
-- and supabase-js is only used for auth and Storage (with the service-role key). So: RLS on with
-- no policies, and no table privileges for the API roles.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bank_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "folder_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "folders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "page_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pomodoro_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_pages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quizzes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roadmap_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "streak_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_achievements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- Tables created by future migrations shouldn't be exposed either (Supabase grants the API roles
-- access to new tables by default).
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;