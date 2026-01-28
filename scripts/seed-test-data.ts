/**
 * Comprehensive Test Data Seeder
 *
 * Creates all test accounts needed for end-to-end testing:
 * - Admin account (Super Admin)
 * - Active Lord member
 * - Inactive member (no subscription)
 * - Past Due member (payment failed)
 * - Team Owner + Team Member
 *
 * Run: npx tsx scripts/seed-test-data.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { hashPassword } from '../src/lib/password.js';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface TestAccount {
  type: 'admin' | 'member';
  email: string;
  password: string;
  data: Record<string, unknown>;
}

const TEST_ACCOUNTS: TestAccount[] = [
  // Super Admin
  {
    type: 'admin',
    email: 'admin@admin.com',
    password: 'admin123',
    data: {
      role: 'SUPER_ADMIN',
    },
  },

  // Active Lord Member (full access)
  {
    type: 'member',
    email: 'lord@revenuecouncil.test',
    password: 'LordTest2026!',
    data: {
      subscriptionStatus: 'ACTIVE',
      seatTier: 'OWNER',
      introCompleted: true,
      introCompletedAt: new Date(),
      firstName: 'Test',
      lastName: 'Lord',
      company: 'Revenue Council Testing',
      jobTitle: 'Chief Revenue Officer',
      totalPoints: 500,
      currentStreak: 7,
      leaderboardVisible: true,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      stripeCustomerId: 'cus_test_lord',
    },
  },

  // Inactive Member (no subscription)
  {
    type: 'member',
    email: 'inactive@revenuecouncil.test',
    password: 'InactiveTest2026!',
    data: {
      subscriptionStatus: 'NONE',
      seatTier: null,
      introCompleted: false,
      firstName: 'Inactive',
      lastName: 'User',
      company: 'No Subscription Inc',
      jobTitle: 'Prospect',
      totalPoints: 0,
      currentStreak: 0,
      leaderboardVisible: false,
    },
  },

  // Past Due Member (payment failed, in grace period)
  {
    type: 'member',
    email: 'pastdue@revenuecouncil.test',
    password: 'PastDueTest2026!',
    data: {
      subscriptionStatus: 'PAST_DUE',
      seatTier: 'INDIVIDUAL',
      introCompleted: true,
      introCompletedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      firstName: 'Past',
      lastName: 'Due',
      company: 'Payment Issues LLC',
      jobTitle: 'Account Manager',
      totalPoints: 150,
      currentStreak: 0,
      leaderboardVisible: true,
      paymentFailedAt: new Date(),
      gracePeriodEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      stripeCustomerId: 'cus_test_pastdue',
    },
  },

  // Cancelled Member (subscription ended)
  {
    type: 'member',
    email: 'cancelled@revenuecouncil.test',
    password: 'CancelledTest2026!',
    data: {
      subscriptionStatus: 'CANCELLED',
      seatTier: 'INDIVIDUAL',
      introCompleted: true,
      introCompletedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      firstName: 'Cancelled',
      lastName: 'Member',
      company: 'Former Member Corp',
      jobTitle: 'Ex-Subscriber',
      totalPoints: 275,
      currentStreak: 0,
      leaderboardVisible: false,
      stripeCustomerId: 'cus_test_cancelled',
    },
  },

  // Individual Knight Member
  {
    type: 'member',
    email: 'knight@revenuecouncil.test',
    password: 'KnightTest2026!',
    data: {
      subscriptionStatus: 'ACTIVE',
      seatTier: 'INDIVIDUAL',
      introCompleted: true,
      introCompletedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      firstName: 'Test',
      lastName: 'Knight',
      company: 'Individual Subscriber LLC',
      jobTitle: 'Sales Manager',
      totalPoints: 125,
      currentStreak: 3,
      leaderboardVisible: true,
      currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      stripeCustomerId: 'cus_test_knight',
    },
  },
];

async function seedAdmins() {
  console.log('\n--- Seeding Admins ---');

  const adminAccounts = TEST_ACCOUNTS.filter((a) => a.type === 'admin');

  for (const account of adminAccounts) {
    const passwordHash = await hashPassword(account.password);

    // Upsert admin
    const admin = await prisma.admin.upsert({
      where: { email: account.email },
      update: {
        passwordHash,
        ...account.data,
      },
      create: {
        email: account.email,
        passwordHash,
        role: account.data.role as 'ADMIN' | 'SUPER_ADMIN',
      },
    });

    console.log(`  ✓ ${account.email} (${account.data.role})`);
  }
}

async function seedMembers() {
  console.log('\n--- Seeding Members ---');

  const memberAccounts = TEST_ACCOUNTS.filter((a) => a.type === 'member');

  for (const account of memberAccounts) {
    const passwordHash = await hashPassword(account.password);

    // Upsert member
    const member = await prisma.member.upsert({
      where: { email: account.email },
      update: {
        passwordHash,
        ...account.data,
      },
      create: {
        email: account.email,
        passwordHash,
        subscriptionStatus: (account.data.subscriptionStatus as string) || 'NONE',
        seatTier: account.data.seatTier as string | null,
        introCompleted: (account.data.introCompleted as boolean) || false,
        introCompletedAt: account.data.introCompletedAt as Date | undefined,
        firstName: account.data.firstName as string | undefined,
        lastName: account.data.lastName as string | undefined,
        company: account.data.company as string | undefined,
        jobTitle: account.data.jobTitle as string | undefined,
        totalPoints: (account.data.totalPoints as number) || 0,
        currentStreak: (account.data.currentStreak as number) || 0,
        leaderboardVisible: (account.data.leaderboardVisible as boolean) || false,
        currentPeriodEnd: account.data.currentPeriodEnd as Date | undefined,
        stripeCustomerId: account.data.stripeCustomerId as string | undefined,
        paymentFailedAt: account.data.paymentFailedAt as Date | undefined,
        gracePeriodEndsAt: account.data.gracePeriodEndsAt as Date | undefined,
      },
    });

    const status = account.data.subscriptionStatus || 'NONE';
    const tier = account.data.seatTier || 'N/A';
    console.log(`  ✓ ${account.email} (${status} / ${tier})`);
  }
}

async function seedTeam() {
  console.log('\n--- Seeding Team ---');

  // Create or find team
  let team = await prisma.team.findFirst({
    where: { name: 'Test Team Corp' },
  });

  if (!team) {
    team = await prisma.team.create({
      data: {
        name: 'Test Team Corp',
        stripeCustomerId: 'cus_test_team',
        subscriptionStatus: 'ACTIVE',
        ownerSeatCount: 2,
        teamSeatCount: 3,
      },
    });
    console.log('  ✓ Team created: Test Team Corp');
  } else {
    console.log('  ✓ Team exists: Test Team Corp');
  }

  // Create team owner
  const ownerHash = await hashPassword('TeamOwner2026!');
  const owner = await prisma.member.upsert({
    where: { email: 'teamowner@revenuecouncil.test' },
    update: {
      passwordHash: ownerHash,
      teamId: team.id,
      isPrimaryOwner: true,
      isTeamAdmin: true,
      subscriptionStatus: 'ACTIVE',
      seatTier: 'OWNER',
    },
    create: {
      email: 'teamowner@revenuecouncil.test',
      passwordHash: ownerHash,
      teamId: team.id,
      isPrimaryOwner: true,
      isTeamAdmin: true,
      subscriptionStatus: 'ACTIVE',
      seatTier: 'OWNER',
      firstName: 'Team',
      lastName: 'Owner',
      company: 'Test Team Corp',
      jobTitle: 'CEO',
      introCompleted: true,
      introCompletedAt: new Date(),
      totalPoints: 300,
      currentStreak: 5,
      leaderboardVisible: true,
    },
  });
  console.log('  ✓ teamowner@revenuecouncil.test (OWNER / Primary)');

  // Create team member
  const memberHash = await hashPassword('TeamMember2026!');
  const teamMember = await prisma.member.upsert({
    where: { email: 'teammember@revenuecouncil.test' },
    update: {
      passwordHash: memberHash,
      teamId: team.id,
      isPrimaryOwner: false,
      isTeamAdmin: false,
      subscriptionStatus: 'ACTIVE',
      seatTier: 'TEAM_MEMBER',
    },
    create: {
      email: 'teammember@revenuecouncil.test',
      passwordHash: memberHash,
      teamId: team.id,
      isPrimaryOwner: false,
      isTeamAdmin: false,
      subscriptionStatus: 'ACTIVE',
      seatTier: 'TEAM_MEMBER',
      firstName: 'Team',
      lastName: 'Member',
      company: 'Test Team Corp',
      jobTitle: 'Sales Rep',
      introCompleted: true,
      introCompletedAt: new Date(),
      totalPoints: 75,
      currentStreak: 2,
      leaderboardVisible: true,
    },
  });
  console.log('  ✓ teammember@revenuecouncil.test (TEAM_MEMBER)');
}

async function seedPointConfigs() {
  console.log('\n--- Seeding Point Configs ---');

  const configs = [
    { action: 'benchmark_submission', points: 50, label: 'Benchmark Submission', description: 'Points for submitting benchmark data' },
    { action: 'resource_download', points: 5, label: 'Resource Download', description: 'Points for downloading a resource' },
    { action: 'discord_activity', points: 1, label: 'Discord Activity', description: 'Points per 100 XP synced from MEE6' },
    { action: 'intro_completed', points: 25, label: 'Introduction Posted', description: 'Points for posting in #introductions' },
    { action: 'admin_adjustment', points: 0, label: 'Admin Adjustment', description: 'Manual point adjustment by admin' },
  ];

  for (const config of configs) {
    await prisma.pointConfig.upsert({
      where: { action: config.action },
      update: {
        points: config.points,
        label: config.label,
        description: config.description,
        enabled: true,
      },
      create: {
        action: config.action,
        points: config.points,
        label: config.label,
        description: config.description,
        enabled: config.action !== 'admin_adjustment',
      },
    });
    console.log(`  ✓ ${config.action}: ${config.points} pts`);
  }
}

async function seedFeatureFlags() {
  console.log('\n--- Seeding Feature Flags ---');

  const flags = [
    { key: 'benchmarks_enabled', enabled: true, description: 'Enable benchmark submission', category: 'features' },
    { key: 'resources_enabled', enabled: true, description: 'Enable resource library', category: 'features' },
    { key: 'leaderboard_enabled', enabled: true, description: 'Enable public leaderboard', category: 'features' },
    { key: 'mee6_sync_enabled', enabled: false, description: 'Enable MEE6 XP syncing', category: 'integrations' },
    { key: 'maintenance_mode', enabled: false, description: 'Put site in maintenance mode', category: 'system' },
  ];

  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: {
        enabled: flag.enabled,
        description: flag.description,
        category: flag.category,
      },
      create: flag,
    });
    console.log(`  ✓ ${flag.key}: ${flag.enabled ? 'ON' : 'OFF'}`);
  }
}

async function printSummary() {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    TEST DATA SEEDED SUCCESSFULLY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n ADMIN ACCOUNTS:');
  console.log(' ───────────────────────────────────────────────────────────────');
  console.log(' Email                    │ Password   │ Role');
  console.log(' ───────────────────────────────────────────────────────────────');
  console.log(' admin@admin.com          │ admin123   │ SUPER_ADMIN');

  console.log('\n MEMBER ACCOUNTS:');
  console.log(' ───────────────────────────────────────────────────────────────');
  console.log(' Email                         │ Password          │ Status');
  console.log(' ───────────────────────────────────────────────────────────────');

  const memberAccounts = TEST_ACCOUNTS.filter((a) => a.type === 'member');
  for (const account of memberAccounts) {
    const email = account.email.padEnd(30);
    const pwd = account.password.padEnd(17);
    const status = account.data.subscriptionStatus || 'NONE';
    console.log(` ${email}│ ${pwd}│ ${status}`);
  }

  console.log('\n TEAM ACCOUNTS:');
  console.log(' ───────────────────────────────────────────────────────────────');
  console.log(' teamowner@revenuecouncil.test │ TeamOwner2026!    │ OWNER (Primary)');
  console.log(' teammember@revenuecouncil.test│ TeamMember2026!   │ TEAM_MEMBER');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' URLs:');
  console.log('   Member Login:  http://localhost:3001/login');
  console.log('   Admin Login:   http://localhost:3001/admin/login');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

async function main() {
  console.log('Starting comprehensive test data seed...\n');

  try {
    await seedAdmins();
    await seedMembers();
    await seedTeam();
    await seedPointConfigs();
    await seedFeatureFlags();
    await printSummary();
  } catch (error) {
    console.error('Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
