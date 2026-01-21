import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { hashPassword } from '../src/lib/password.js';
import { generateInviteToken } from '../src/lib/invite-tokens.js';
import 'dotenv/config';

// ============================================
// Configuration
// ============================================

const TEST_EMAIL_DOMAIN = '@test.example.com';
const TEST_TEAM_PREFIX = 'test_';
const TEST_PASSWORD = 'TestPassword123!'; // All test accounts use same password

// ============================================
// Database Connection
// ============================================

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ============================================
// Cleanup Functions
// ============================================

async function cleanupTestData(): Promise<void> {
  console.log('\n--- Cleaning up test data ---\n');

  // Delete in dependency order to avoid FK violations

  // 1. Delete pending invites (references teams and members)
  console.log('Deleting pending invites...');
  const inviteResult = await prisma.pendingInvite.deleteMany({
    where: {
      OR: [
        { inviteeEmail: { contains: TEST_EMAIL_DOMAIN } },
        { team: { stripeCustomerId: { startsWith: TEST_TEAM_PREFIX } } },
      ],
    },
  });
  console.log(`  Deleted ${inviteResult.count} pending invites`);

  // 2. Delete test members (references teams)
  console.log('Deleting test members...');
  const memberResult = await prisma.member.deleteMany({
    where: { email: { contains: TEST_EMAIL_DOMAIN } },
  });
  console.log(`  Deleted ${memberResult.count} members`);

  // 3. Delete test teams
  console.log('Deleting test teams...');
  const teamResult = await prisma.team.deleteMany({
    where: { stripeCustomerId: { startsWith: TEST_TEAM_PREFIX } },
  });
  console.log(`  Deleted ${teamResult.count} teams`);

  // 4. Delete test admins (preserves non-test admins)
  console.log('Deleting test admins...');
  const adminResult = await prisma.admin.deleteMany({
    where: { email: { contains: TEST_EMAIL_DOMAIN } },
  });
  console.log(`  Deleted ${adminResult.count} admins`);
}

// ============================================
// Helper Functions
// ============================================

function generateFakeDiscordId(): string {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `test_discord_${randomNum}`;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

// ============================================
// Seed Functions
// ============================================

async function seedTestAdmins(): Promise<void> {
  console.log('\n--- Seeding test admins ---\n');

  const passwordHash = await hashPassword(TEST_PASSWORD);

  // Super admin
  await prisma.admin.create({
    data: {
      email: `admin${TEST_EMAIL_DOMAIN}`,
      passwordHash,
      role: 'SUPER_ADMIN',
    },
  });
  console.log(`  Created SUPER_ADMIN: admin${TEST_EMAIL_DOMAIN}`);

  // Regular admin
  await prisma.admin.create({
    data: {
      email: `support${TEST_EMAIL_DOMAIN}`,
      passwordHash,
      role: 'ADMIN',
    },
  });
  console.log(`  Created ADMIN: support${TEST_EMAIL_DOMAIN}`);
}

async function seedIndividualMembers(): Promise<void> {
  console.log('\n--- Seeding individual members ---\n');

  const passwordHash = await hashPassword(TEST_PASSWORD);
  const currentPeriodEnd = daysFromNow(30);

  // Active individuals with completed intro (Lords) - 5 members
  for (let i = 1; i <= 5; i++) {
    await prisma.member.create({
      data: {
        email: `test-active-ind-${i}${TEST_EMAIL_DOMAIN}`,
        passwordHash,
        discordId: generateFakeDiscordId(),
        discordUsername: `TestLord${i}`,
        subscriptionStatus: 'ACTIVE',
        seatTier: 'INDIVIDUAL',
        currentPeriodEnd,
        introCompleted: true,
        introCompletedAt: daysAgo(i * 7), // Staggered intro dates
        firstName: 'Lord',
        lastName: `Test${i}`,
      },
    });
  }
  console.log('  Created 5 active individuals with intro (Lords)');

  // Active individuals without intro (Squires - Discord linked but no intro) - 2 members
  for (let i = 1; i <= 2; i++) {
    await prisma.member.create({
      data: {
        email: `test-active-squire-${i}${TEST_EMAIL_DOMAIN}`,
        passwordHash,
        discordId: generateFakeDiscordId(),
        discordUsername: `TestSquire${i}`,
        subscriptionStatus: 'ACTIVE',
        seatTier: 'INDIVIDUAL',
        currentPeriodEnd,
        introCompleted: false,
        firstName: 'Squire',
        lastName: `Test${i}`,
      },
    });
  }
  console.log('  Created 2 active individuals without intro (Squires)');

  // Unclaimed individuals (no Discord linked yet) - 2 members
  for (let i = 1; i <= 2; i++) {
    await prisma.member.create({
      data: {
        email: `test-unclaimed-${i}${TEST_EMAIL_DOMAIN}`,
        passwordHash,
        subscriptionStatus: 'ACTIVE',
        seatTier: 'INDIVIDUAL',
        currentPeriodEnd,
        introCompleted: false,
      },
    });
  }
  console.log('  Created 2 unclaimed individuals (no Discord)');

  // Grace period members (payment failed within 48h) - 2 members
  for (let i = 1; i <= 2; i++) {
    await prisma.member.create({
      data: {
        email: `test-grace-${i}${TEST_EMAIL_DOMAIN}`,
        passwordHash,
        discordId: generateFakeDiscordId(),
        discordUsername: `TestGrace${i}`,
        subscriptionStatus: 'PAST_DUE',
        seatTier: 'INDIVIDUAL',
        currentPeriodEnd,
        introCompleted: true,
        introCompletedAt: daysAgo(30),
        firstName: 'Grace',
        lastName: `Test${i}`,
        paymentFailedAt: hoursAgo(24),
        gracePeriodEndsAt: hoursFromNow(24),
        previousRole: 'Lord',
      },
    });
  }
  console.log('  Created 2 grace period members (PAST_DUE, within 48h)');

  // Debtor state members (past grace period) - 2 members
  for (let i = 1; i <= 2; i++) {
    await prisma.member.create({
      data: {
        email: `test-debtor-${i}${TEST_EMAIL_DOMAIN}`,
        passwordHash,
        discordId: generateFakeDiscordId(),
        discordUsername: `TestDebtor${i}`,
        subscriptionStatus: 'PAST_DUE',
        seatTier: 'INDIVIDUAL',
        currentPeriodEnd,
        introCompleted: true,
        introCompletedAt: daysAgo(60),
        firstName: 'Debtor',
        lastName: `Test${i}`,
        paymentFailedAt: daysAgo(7),
        gracePeriodEndsAt: daysAgo(5),
        isInDebtorState: true,
        debtorStateEndsAt: daysFromNow(23),
        previousRole: 'Lord',
      },
    });
  }
  console.log('  Created 2 debtor state members (PAST_DUE, past grace)');

  // Cancelled members - 2 members
  for (let i = 1; i <= 2; i++) {
    await prisma.member.create({
      data: {
        email: `test-cancelled-${i}${TEST_EMAIL_DOMAIN}`,
        passwordHash,
        // No discordId - they've been removed
        subscriptionStatus: 'CANCELLED',
        seatTier: 'INDIVIDUAL',
        introCompleted: true,
        introCompletedAt: daysAgo(90),
        firstName: 'Cancelled',
        lastName: `Test${i}`,
      },
    });
  }
  console.log('  Created 2 cancelled members');

  // Claim reminder timing test members (unclaimed at different ages)
  // 48 hours old
  const remind48h = await prisma.member.create({
    data: {
      email: `test-remind-48h${TEST_EMAIL_DOMAIN}`,
      subscriptionStatus: 'ACTIVE',
      seatTier: 'INDIVIDUAL',
      currentPeriodEnd,
      introCompleted: false,
    },
  });
  // Update createdAt manually via raw SQL
  await prisma.$executeRaw`UPDATE "Member" SET "createdAt" = ${daysAgo(2)} WHERE id = ${remind48h.id}`;

  // 7 days old
  const remind7d = await prisma.member.create({
    data: {
      email: `test-remind-7d${TEST_EMAIL_DOMAIN}`,
      subscriptionStatus: 'ACTIVE',
      seatTier: 'INDIVIDUAL',
      currentPeriodEnd,
      introCompleted: false,
    },
  });
  await prisma.$executeRaw`UPDATE "Member" SET "createdAt" = ${daysAgo(7)} WHERE id = ${remind7d.id}`;

  // 30 days old
  const remind30d = await prisma.member.create({
    data: {
      email: `test-remind-30d${TEST_EMAIL_DOMAIN}`,
      subscriptionStatus: 'ACTIVE',
      seatTier: 'INDIVIDUAL',
      currentPeriodEnd,
      introCompleted: false,
    },
  });
  await prisma.$executeRaw`UPDATE "Member" SET "createdAt" = ${daysAgo(30)} WHERE id = ${remind30d.id}`;

  console.log('  Created 3 claim reminder test members (48h, 7d, 30d old)');

  console.log('\n  Total individual members created: 18');
}

async function seedTeamsWithMembers(): Promise<void> {
  console.log('\n--- Seeding teams with members ---\n');

  const passwordHash = await hashPassword(TEST_PASSWORD);
  const currentPeriodEnd = daysFromNow(30);

  // ============================================
  // Team 1: Acme Corp (Healthy team)
  // ============================================
  const acmeTeam = await prisma.team.create({
    data: {
      name: 'Acme Corporation',
      stripeCustomerId: `${TEST_TEAM_PREFIX}acme_corp`,
      subscriptionStatus: 'ACTIVE',
      ownerSeatCount: 2,
      teamSeatCount: 3,
    },
  });

  // Primary owner (introduced)
  const acmeOwner = await prisma.member.create({
    data: {
      email: `test-acme-owner${TEST_EMAIL_DOMAIN}`,
      passwordHash,
      discordId: generateFakeDiscordId(),
      discordUsername: 'AcmeOwner',
      subscriptionStatus: 'ACTIVE',
      seatTier: 'OWNER',
      currentPeriodEnd,
      introCompleted: true,
      introCompletedAt: daysAgo(60),
      firstName: 'Alice',
      lastName: 'Acme',
      company: 'Acme Corporation',
      jobTitle: 'CEO',
      teamId: acmeTeam.id,
      isTeamAdmin: true,
      isPrimaryOwner: true,
    },
  });

  // Second owner (introduced)
  await prisma.member.create({
    data: {
      email: `test-acme-owner2${TEST_EMAIL_DOMAIN}`,
      passwordHash,
      discordId: generateFakeDiscordId(),
      discordUsername: 'AcmeOwner2',
      subscriptionStatus: 'ACTIVE',
      seatTier: 'OWNER',
      currentPeriodEnd,
      introCompleted: true,
      introCompletedAt: daysAgo(45),
      firstName: 'Bob',
      lastName: 'Acme',
      company: 'Acme Corporation',
      jobTitle: 'CTO',
      teamId: acmeTeam.id,
      isTeamAdmin: false,
      isPrimaryOwner: false,
    },
  });

  // Team member 1 (introduced - Knight)
  await prisma.member.create({
    data: {
      email: `test-acme-member1${TEST_EMAIL_DOMAIN}`,
      passwordHash,
      discordId: generateFakeDiscordId(),
      discordUsername: 'AcmeMember1',
      subscriptionStatus: 'ACTIVE',
      seatTier: 'TEAM_MEMBER',
      currentPeriodEnd,
      introCompleted: true,
      introCompletedAt: daysAgo(30),
      firstName: 'Charlie',
      lastName: 'Acme',
      company: 'Acme Corporation',
      jobTitle: 'Engineer',
      teamId: acmeTeam.id,
    },
  });

  // Team member 2 (introduced - Knight)
  await prisma.member.create({
    data: {
      email: `test-acme-member2${TEST_EMAIL_DOMAIN}`,
      passwordHash,
      discordId: generateFakeDiscordId(),
      discordUsername: 'AcmeMember2',
      subscriptionStatus: 'ACTIVE',
      seatTier: 'TEAM_MEMBER',
      currentPeriodEnd,
      introCompleted: true,
      introCompletedAt: daysAgo(15),
      firstName: 'Diana',
      lastName: 'Acme',
      company: 'Acme Corporation',
      jobTitle: 'Designer',
      teamId: acmeTeam.id,
    },
  });

  // Team member 3 (NOT introduced - Squire)
  await prisma.member.create({
    data: {
      email: `test-acme-squire${TEST_EMAIL_DOMAIN}`,
      passwordHash,
      discordId: generateFakeDiscordId(),
      discordUsername: 'AcmeSquire',
      subscriptionStatus: 'ACTIVE',
      seatTier: 'TEAM_MEMBER',
      currentPeriodEnd,
      introCompleted: false,
      firstName: 'Eve',
      lastName: 'Acme',
      company: 'Acme Corporation',
      jobTitle: 'Intern',
      teamId: acmeTeam.id,
    },
  });

  // Pending invite for Acme
  await prisma.pendingInvite.create({
    data: {
      teamId: acmeTeam.id,
      seatTier: 'TEAM_MEMBER',
      token: generateInviteToken(),
      createdBy: acmeOwner.id,
      inviteeEmail: `test-acme-pending${TEST_EMAIL_DOMAIN}`,
    },
  });

  console.log('  Created Acme Corp: 2 owners + 3 team members + 1 pending invite');

  // ============================================
  // Team 2: Beta Inc (Billing failure - debtor state)
  // ============================================
  const betaTeam = await prisma.team.create({
    data: {
      name: 'Beta Inc',
      stripeCustomerId: `${TEST_TEAM_PREFIX}beta_inc`,
      subscriptionStatus: 'PAST_DUE',
      ownerSeatCount: 1,
      teamSeatCount: 2,
      paymentFailedAt: daysAgo(3),
      gracePeriodEndsAt: daysAgo(1),
      debtorStateEndsAt: daysFromNow(27),
    },
  });

  // Beta owner (in debtor state)
  const betaOwner = await prisma.member.create({
    data: {
      email: `test-beta-owner${TEST_EMAIL_DOMAIN}`,
      passwordHash,
      discordId: generateFakeDiscordId(),
      discordUsername: 'BetaOwner',
      subscriptionStatus: 'PAST_DUE',
      seatTier: 'OWNER',
      currentPeriodEnd,
      introCompleted: true,
      introCompletedAt: daysAgo(90),
      firstName: 'Frank',
      lastName: 'Beta',
      company: 'Beta Inc',
      jobTitle: 'Founder',
      teamId: betaTeam.id,
      isTeamAdmin: true,
      isPrimaryOwner: true,
      paymentFailedAt: daysAgo(3),
      gracePeriodEndsAt: daysAgo(1),
      isInDebtorState: true,
      debtorStateEndsAt: daysFromNow(27),
      previousRole: 'Lord',
    },
  });

  // Beta member 1 (in debtor state)
  await prisma.member.create({
    data: {
      email: `test-beta-member1${TEST_EMAIL_DOMAIN}`,
      passwordHash,
      discordId: generateFakeDiscordId(),
      discordUsername: 'BetaMember1',
      subscriptionStatus: 'PAST_DUE',
      seatTier: 'TEAM_MEMBER',
      currentPeriodEnd,
      introCompleted: true,
      introCompletedAt: daysAgo(75),
      firstName: 'Grace',
      lastName: 'Beta',
      company: 'Beta Inc',
      jobTitle: 'Manager',
      teamId: betaTeam.id,
      paymentFailedAt: daysAgo(3),
      gracePeriodEndsAt: daysAgo(1),
      isInDebtorState: true,
      debtorStateEndsAt: daysFromNow(27),
      previousRole: 'Knight',
    },
  });

  // Beta member 2 (in debtor state)
  await prisma.member.create({
    data: {
      email: `test-beta-member2${TEST_EMAIL_DOMAIN}`,
      passwordHash,
      discordId: generateFakeDiscordId(),
      discordUsername: 'BetaMember2',
      subscriptionStatus: 'PAST_DUE',
      seatTier: 'TEAM_MEMBER',
      currentPeriodEnd,
      introCompleted: true,
      introCompletedAt: daysAgo(60),
      firstName: 'Henry',
      lastName: 'Beta',
      company: 'Beta Inc',
      jobTitle: 'Analyst',
      teamId: betaTeam.id,
      paymentFailedAt: daysAgo(3),
      gracePeriodEndsAt: daysAgo(1),
      isInDebtorState: true,
      debtorStateEndsAt: daysFromNow(27),
      previousRole: 'Knight',
    },
  });

  console.log('  Created Beta Inc: 1 owner + 2 team members (all in debtor state)');

  // ============================================
  // Team 3: Gamma LLC (New team with pending invites)
  // ============================================
  const gammaTeam = await prisma.team.create({
    data: {
      name: 'Gamma LLC',
      stripeCustomerId: `${TEST_TEAM_PREFIX}gamma_llc`,
      subscriptionStatus: 'ACTIVE',
      ownerSeatCount: 2,
      teamSeatCount: 2,
    },
  });

  // Gamma owner (NOT introduced - new user)
  const gammaOwner = await prisma.member.create({
    data: {
      email: `test-gamma-owner${TEST_EMAIL_DOMAIN}`,
      passwordHash,
      discordId: generateFakeDiscordId(),
      discordUsername: 'GammaOwner',
      subscriptionStatus: 'ACTIVE',
      seatTier: 'OWNER',
      currentPeriodEnd,
      introCompleted: false,
      firstName: 'Ivan',
      lastName: 'Gamma',
      company: 'Gamma LLC',
      jobTitle: 'Director',
      teamId: gammaTeam.id,
      isTeamAdmin: true,
      isPrimaryOwner: true,
    },
  });

  // Pending invite for second owner
  await prisma.pendingInvite.create({
    data: {
      teamId: gammaTeam.id,
      seatTier: 'OWNER',
      token: generateInviteToken(),
      createdBy: gammaOwner.id,
      inviteeEmail: `test-gamma-owner2${TEST_EMAIL_DOMAIN}`,
    },
  });

  // Pending invite for team member
  await prisma.pendingInvite.create({
    data: {
      teamId: gammaTeam.id,
      seatTier: 'TEAM_MEMBER',
      token: generateInviteToken(),
      createdBy: gammaOwner.id,
      inviteeEmail: `test-gamma-member${TEST_EMAIL_DOMAIN}`,
    },
  });

  console.log('  Created Gamma LLC: 1 owner (new) + 2 pending invites');

  console.log('\n  Total team members created: 9');
  console.log('  Total pending invites created: 3');
}

// ============================================
// Main Function
// ============================================

async function main() {
  console.log('========================================');
  console.log('TRC Seed Script - Test Data Generator');
  console.log('========================================');

  try {
    // Clean up existing test data
    await cleanupTestData();

    // Seed fresh test data
    await seedTestAdmins();
    await seedIndividualMembers();
    await seedTeamsWithMembers();

    // Summary
    console.log('\n========================================');
    console.log('Seed Complete!');
    console.log('========================================\n');
    console.log('Created:');
    console.log('  - 2 test admins (admin@, support@)');
    console.log('  - 18 individual members');
    console.log('  - 3 teams with 9 team members');
    console.log('  - 3 pending invites');
    console.log('\nAll test accounts use password: TestPassword123!');
    console.log(`All test emails use domain: ${TEST_EMAIL_DOMAIN}`);
    console.log('\n');
  } catch (error) {
    console.error('Seed failed:', error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
