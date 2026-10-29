// The one Prisma client for the hosted database. Prisma 7 talks to Postgres through a driver
// adapter; the generated client (src/generated/prisma, built by `prisma generate`) is
// TypeScript that Node loads directly by stripping its types.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.ts";

export function createPrismaClient(databaseUrl) {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}
