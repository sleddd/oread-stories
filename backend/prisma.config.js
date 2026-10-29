// Prisma CLI configuration: where the schema and migrations live, and the database to use.
// The URL comes from the environment, or from backend/.env when that file exists. Migrations
// prefer DIRECT_DATABASE_URL, because a pooled connection can't hold the lock migrate needs;
// without it they use DATABASE_URL.
import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

const LOCAL_ENVIRONMENT_FILE = ".env";

if (existsSync(LOCAL_ENVIRONMENT_FILE)) {
  process.loadEnvFile(LOCAL_ENVIRONMENT_FILE);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || "",
  },
});
