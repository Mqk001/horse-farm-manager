import { PrismaClient } from '@prisma/client';
import { PrismaClient as LocalPrismaClient } from '@prisma/local-client';
import { databaseUrl } from './database-url';

const usesLocalDatabase = process.env.DATABASE_URL?.startsWith('file:') ?? false;
const RuntimePrismaClient: typeof PrismaClient = usesLocalDatabase
  ? (LocalPrismaClient as unknown as typeof PrismaClient)
  : PrismaClient;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const url = databaseUrl(process.env.DATABASE_URL, process.env.DATABASE_POOLER_HOST);
export const prisma = globalForPrisma.prisma ?? new RuntimePrismaClient(url ? { datasources: { db: { url } } } : undefined);

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
