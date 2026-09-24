import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// The dev-mode global cache survives hot reloads — but after `prisma generate` the imported class is
// a new one, and reusing the stale instance would hide newly added models. Recreate in that case.
const cached = globalForPrisma.prisma;
export const prisma =
  cached && cached instanceof PrismaClient ? cached : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
