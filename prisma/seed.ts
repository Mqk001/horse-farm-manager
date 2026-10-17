import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/passwords';

const prisma = new PrismaClient();

async function main() {
  if (process.env.SEED_ALLOW_RESET !== 'true') throw new Error('Seeding deletes existing data. Set SEED_ALLOW_RESET=true only for an intentional disposable/demo database reset.');
  const ownerPassword = process.env.SEED_OWNER_PASSWORD;
  const staffPassword = process.env.SEED_STAFF_PASSWORD;
  if (!ownerPassword || !staffPassword || ownerPassword.length < 12 || staffPassword.length < 12 || ownerPassword === staffPassword) throw new Error('Set distinct SEED_OWNER_PASSWORD and SEED_STAFF_PASSWORD values of at least 12 characters before seeding.');
  // Validate/hash before any destructive seed operation.
  const ownerHash = await hashPassword(ownerPassword);
  const staffHash = await hashPassword(staffPassword);
  console.log('🌱 Seeding database...');

  await prisma.user.deleteMany();
  await prisma.trainer.deleteMany();
  await prisma.horse.deleteMany();
  await prisma.settings.deleteMany();

  await prisma.user.create({
    data: {
      email: 'owner@horsefarm.com',
      password: ownerHash,
      name: 'Farm Owner',
      role: 'OWNER',
    },
  });

  await prisma.user.create({
    data: {
      email: 'staff@horsefarm.com',
      password: staffHash,
      name: 'Farm Staff',
      role: 'STAFF',
    },
  });

  const trainer = await prisma.trainer.create({
    data: {
      name: 'Sarah Johnson',
      email: 'sarah@trainers.com',
      phone: '555-0101',
    },
  });

  await prisma.horse.create({
    data: {
      name: 'Thunder',
      age: 8,
      breed: 'Thoroughbred',
      colorMarkings: 'Bay with white blaze',
      status: 'ACTIVE',
    },
  });

  await prisma.horse.create({
    data: {
      name: 'Bella',
      age: 5,
      breed: 'Quarter Horse',
      colorMarkings: 'Sorrel',
      status: 'ACTIVE',
    },
  });

  await prisma.settings.create({
    data: {
      id: 'global',
      defaultRideIntervalDays: 3,
      defaultWashIntervalDays: 14,
      vetAlertLeadTimeDays: 7,
    },
  });

  console.log('✅ Seed completed!');
  console.log('Seed accounts created using the supplied passwords.');
}

main()
  .catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
