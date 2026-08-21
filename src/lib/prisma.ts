import { PrismaClient } from '@prisma/client';
import { PrismaClient as LocalPrismaClient } from '@prisma/local-client';

const usesLocalDatabase = process.env.DATABASE_URL?.startsWith('file:') ?? false;
const RuntimePrismaClient: typeof PrismaClient = usesLocalDatabase
  ? (LocalPrismaClient as unknown as typeof PrismaClient)
  : PrismaClient;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new RuntimePrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
