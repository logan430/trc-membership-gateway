import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Create a direct prisma client for this script
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function testPointsTrigger() {
  console.log('=== Points Trigger Test ===\n');

  // Create or find a test member
  const testEmail = `trigger-test-${Date.now()}@example.com`;
  console.log('1. Creating test member...');
  const member = await prisma.member.create({
    data: {
      email: testEmail,
      totalPoints: 0,
      currentStreak: 0,
    },
  });
  console.log('   Member ID:', member.id);
  console.log('   Initial totalPoints:', member.totalPoints);
  console.log('   Initial lastActiveAt:', member.lastActiveAt);

  // Insert a point transaction (positive)
  console.log('\n2. Creating positive point transaction (50 points)...');
  const txn1 = await prisma.pointTransaction.create({
    data: {
      memberId: member.id,
      action: 'test_positive',
      points: 50,
      metadata: { test: true },
    },
  });
  console.log('   Transaction ID:', txn1.id);

  // Check if totalPoints was updated by trigger
  const afterPositive = await prisma.member.findUnique({
    where: { id: member.id },
  });
  console.log('   Member totalPoints after:', afterPositive?.totalPoints);
  console.log('   Member lastActiveAt after:', afterPositive?.lastActiveAt);

  const test1Pass = afterPositive?.totalPoints === 50;
  console.log('   [', test1Pass ? 'PASS' : 'FAIL', '] Positive points trigger');

  // Insert another point transaction
  console.log('\n3. Creating another positive transaction (25 points)...');
  await prisma.pointTransaction.create({
    data: {
      memberId: member.id,
      action: 'test_positive_2',
      points: 25,
      metadata: { test: true },
    },
  });

  const afterSecond = await prisma.member.findUnique({
    where: { id: member.id },
  });
  console.log('   Member totalPoints after:', afterSecond?.totalPoints);

  const test2Pass = afterSecond?.totalPoints === 75;
  console.log('   [', test2Pass ? 'PASS' : 'FAIL', '] Cumulative points trigger');

  // Insert a negative point transaction (admin adjustment)
  console.log('\n4. Creating negative point transaction (-10 points)...');
  const previousLastActive = afterSecond?.lastActiveAt;
  await prisma.pointTransaction.create({
    data: {
      memberId: member.id,
      action: 'admin_adjustment',
      points: -10,
      metadata: { reason: 'Test deduction' },
    },
  });

  const afterNegative = await prisma.member.findUnique({
    where: { id: member.id },
  });
  console.log('   Member totalPoints after:', afterNegative?.totalPoints);
  console.log('   Member lastActiveAt after:', afterNegative?.lastActiveAt);

  const test3Pass = afterNegative?.totalPoints === 65;
  // lastActiveAt should not update for negative points
  const test4Pass = afterNegative?.lastActiveAt?.getTime() === previousLastActive?.getTime();
  console.log('   [', test3Pass ? 'PASS' : 'FAIL', '] Negative points trigger');
  console.log('   [', test4Pass ? 'PASS' : 'FAIL', '] lastActiveAt unchanged for negative');

  // Cleanup
  console.log('\n5. Cleaning up test data...');
  await prisma.pointTransaction.deleteMany({
    where: { memberId: member.id },
  });
  await prisma.member.delete({ where: { id: member.id } });
  console.log('   Cleanup complete');

  // Summary
  console.log('\n=== Summary ===');
  const allPassed = test1Pass && test2Pass && test3Pass && test4Pass;
  console.log(`Tests passed: ${[test1Pass, test2Pass, test3Pass, test4Pass].filter(Boolean).length}/4`);

  if (allPassed) {
    console.log('\nAll trigger tests passed!');
  } else {
    console.log('\nSome tests failed - review above.');
    process.exit(1);
  }
}

testPointsTrigger()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
