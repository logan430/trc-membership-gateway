import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password.js';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  // Check if any admin exists
  const existingAdmin = await prisma.admin.findFirst();

  if (existingAdmin) {
    console.log('Admin already exists, skipping seed');
    return;
  }

  // Get credentials from environment
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must be set for first admin creation'
    );
  }

  const passwordHash = await hashPassword(password);

  await prisma.admin.create({
    data: {
      email,
      passwordHash,
      role: 'SUPER_ADMIN',
    },
  });

  console.log(`Created super admin: ${email}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
