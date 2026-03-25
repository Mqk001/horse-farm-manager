import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  await prisma.user.deleteMany();
  await prisma.trainer.deleteMany();
  await prisma.horse.deleteMany();
  await prisma.settings.deleteMany();

  const hash = await bcrypt.hash('password123', 10);
  
  await prisma.user.create({
    data: {
      email: 'owner@horsefarm.com',
      password: hash,
      name: 'Farm Owner',
      role: 'OWNER',
    },
  });

  await prisma.user.create({
    data: {
      email: 'staff@horsefarm.com',
      password: hash,
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
  console.log('\nTest credentials:');
  console.log('Owner: owner@horsefarm.com / password123');
  console.log('Staff: staff@horsefarm.com / password123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());