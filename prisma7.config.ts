import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // The CLI (migrate/introspect) talks to Postgres directly, bypassing Supabase's
  // connection pooler — the app itself connects via DATABASE_URL (pooled) at runtime,
  // see src/lib/prisma.ts.
  datasource: {
    url: env("DIRECT_URL"),
  },
});
