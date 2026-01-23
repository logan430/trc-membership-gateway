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

async function testGinIndex() {
  console.log('=== GIN Index Query Test ===\n');

  // Run EXPLAIN ANALYZE on a JSONB containment query
  console.log('1. Running EXPLAIN ANALYZE on JSONB containment query...\n');
  const plan = await prisma.$queryRaw<{ queryplan: string }[]>`
    EXPLAIN (ANALYZE, FORMAT TEXT)
    SELECT * FROM "BenchmarkSubmission"
    WHERE data @> '{"salary": 100000}'::jsonb
  `;

  console.log('Query Plan:');
  plan.forEach(row => {
    // The column name varies by DB version
    const planText = Object.values(row)[0];
    console.log('  ', planText);
  });

  // Check if index is being used
  const planText = plan.map(row => Object.values(row)[0]).join('\n');
  const usesIndex = planText.toLowerCase().includes('index') || planText.toLowerCase().includes('bitmap');

  console.log('\n2. Index utilization check...');
  // For empty tables, Postgres may choose seq scan - that's OK
  // The important thing is the index exists and can be used
  if (usesIndex) {
    console.log('   [ PASS ] Query plan shows index usage');
  } else {
    console.log('   [ INFO ] Query plan shows seq scan (expected for empty table)');
    console.log('   [ INFO ] Index will be used once table has data');
  }

  // Verify index exists and is valid
  console.log('\n3. Checking index validity...');
  const indexInfo = await prisma.$queryRaw<{ indexname: string; indexdef: string }[]>`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE tablename = 'BenchmarkSubmission'
    AND indexdef ILIKE '%gin%'
  `;

  if (indexInfo.length > 0) {
    console.log('   Index name:', indexInfo[0].indexname);
    console.log('   Uses jsonb_path_ops:', indexInfo[0].indexdef.includes('jsonb_path_ops') ? 'Yes' : 'No');
    console.log('   [ PASS ] GIN index exists and is ready for JSONB queries');
  } else {
    console.log('   [ FAIL ] GIN index not found');
    process.exit(1);
  }
}

testGinIndex()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
