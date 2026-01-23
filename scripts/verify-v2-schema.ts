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

async function verifySchema() {
  console.log('=== V2.0 Schema Verification ===\n');

  // 1. Verify tables exist (DB-01 through DB-05)
  console.log('1. Checking tables exist...');
  const tables = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('BenchmarkSubmission', 'Resource', 'ResourceDownload', 'PointTransaction', 'DiscordActivity')
    ORDER BY table_name
  `;
  console.log('   Tables found:', tables.map(t => t.table_name).join(', '));
  console.log('   [', tables.length === 5 ? 'PASS' : 'FAIL', '] Expected 5 tables\n');

  // 2. Verify Member columns (DB-06)
  console.log('2. Checking Member columns...');
  const memberColumns = await prisma.$queryRaw<{ column_name: string; data_type: string }[]>`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'Member'
    AND column_name IN ('totalPoints', 'currentStreak', 'lastActiveAt')
    ORDER BY column_name
  `;
  console.log('   Columns found:');
  memberColumns.forEach(c => console.log(`     - ${c.column_name}: ${c.data_type}`));
  console.log('   [', memberColumns.length === 3 ? 'PASS' : 'FAIL', '] Expected 3 columns\n');

  // 3. Verify GIN index exists (DB-08)
  console.log('3. Checking GIN index...');
  const ginIndex = await prisma.$queryRaw<{ indexname: string; indexdef: string }[]>`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE tablename = 'BenchmarkSubmission'
    AND indexdef ILIKE '%gin%'
  `;
  if (ginIndex.length > 0) {
    console.log('   Index found:', ginIndex[0].indexname);
    console.log('   Definition:', ginIndex[0].indexdef.substring(0, 100) + '...');
  }
  console.log('   [', ginIndex.length > 0 ? 'PASS' : 'FAIL', '] GIN index exists\n');

  // 4. Verify trigger exists (DB-07)
  console.log('4. Checking points trigger...');
  const trigger = await prisma.$queryRaw<{ trigger_name: string; event_manipulation: string }[]>`
    SELECT trigger_name, event_manipulation
    FROM information_schema.triggers
    WHERE trigger_name = 'trg_update_member_points'
  `;
  if (trigger.length > 0) {
    console.log('   Trigger found:', trigger[0].trigger_name);
    console.log('   Event:', trigger[0].event_manipulation);
  }
  console.log('   [', trigger.length > 0 ? 'PASS' : 'FAIL', '] Trigger exists\n');

  // 5. Verify foreign keys (DB-09) - use table_constraints view
  console.log('5. Checking foreign keys...');
  const fks = await prisma.$queryRaw<{ constraint_name: string; table_name: string }[]>`
    SELECT tc.constraint_name, tc.table_name
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('BenchmarkSubmission', 'ResourceDownload', 'PointTransaction', 'DiscordActivity')
    ORDER BY tc.constraint_name
  `;
  console.log('   Foreign keys found:');
  fks.forEach(fk => console.log(`     - ${fk.constraint_name} (${fk.table_name})`));
  console.log('   [', fks.length >= 5 ? 'PASS' : 'FAIL', '] Expected at least 5 FKs\n');

  // 6. Check FK validation status (ensure NOT VALID was resolved)
  console.log('6. Checking FK validation status...');
  const invalidFks = await prisma.$queryRaw<{ conname: string }[]>`
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE c.contype = 'f'
    AND NOT c.convalidated
    AND t.relname IN ('BenchmarkSubmission', 'ResourceDownload', 'PointTransaction', 'DiscordActivity')
  `;
  console.log('   Invalid (NOT VALID) FKs:', invalidFks.length === 0 ? 'None' : invalidFks.map(f => f.conname).join(', '));
  console.log('   [', invalidFks.length === 0 ? 'PASS' : 'FAIL', '] All FKs validated\n');

  // Summary
  console.log('=== Summary ===');
  const passed = [
    tables.length === 5,
    memberColumns.length === 3,
    ginIndex.length > 0,
    trigger.length > 0,
    fks.length >= 5,
    invalidFks.length === 0
  ].filter(Boolean).length;
  console.log(`Checks passed: ${passed}/6`);

  if (passed === 6) {
    console.log('\nAll DB requirements verified!');
  } else {
    console.log('\nSome checks failed - review above.');
    process.exit(1);
  }
}

verifySchema()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
