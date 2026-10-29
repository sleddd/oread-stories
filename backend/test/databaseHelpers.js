// Helpers for the tests that need Postgres. They run only when TEST_DATABASE_URL points at a
// migrated database (npm run test:db does both); `npm test` skips them and never loads Prisma.
// Test files run in parallel, so each one makes its own users and deletes only those.
import { randomUUID } from "node:crypto";

export const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? "";
export const databaseSkipReason = testDatabaseUrl
  ? false
  : "set TEST_DATABASE_URL (npm run test:db) to run the database tests";

export async function connectTestDatabase() {
  const { createPrismaClient } = await import("../src/storage/prisma/prismaClient.js");
  return createPrismaClient(testDatabaseUrl);
}

export function uniqueId(prefix) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export async function createTestUser(prisma, userId = uniqueId("user")) {
  await prisma.user.create({
    data: { id: userId, name: userId, email: `${userId}@example.test`, emailVerified: true },
  });
  return userId;
}

// Deleting a user deletes everything they own, through the cascades.
export async function deleteTestUsers(prisma, userIds) {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

export const TEST_SECRET_KEY = Buffer.alloc(32, 7).toString("base64");
