/**
 * Test Resources Seeder
 *
 * Creates sample resources for testing the resource library:
 * - Various resource types (TEMPLATE, SOP, PLAYBOOK, etc.)
 * - Different statuses (PUBLISHED, DRAFT, SCHEDULED)
 * - Tags for filtering
 *
 * Note: This creates database records only. Actual files must be
 * uploaded to Supabase Storage separately for download testing.
 *
 * Run: npx tsx scripts/seed-test-resources.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TAGS = [
  'Sales',
  'Compensation',
  'Leadership',
  'Metrics',
  'Hiring',
  'Training',
  'Strategy',
  'Templates',
];

const RESOURCES = [
  {
    title: 'Sales Compensation Plan Template',
    description: 'A comprehensive template for designing sales compensation plans. Includes base salary, commission structures, accelerators, and SPIFs.',
    type: 'TEMPLATE',
    tags: ['Sales', 'Compensation', 'Templates'],
    status: 'PUBLISHED',
    isFeatured: true,
    storagePath: 'templates/compensation-plan-template.xlsx',
    fileSize: 45000,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    author: 'Revenue Council Team',
  },
  {
    title: 'SDR Onboarding Playbook',
    description: '30-60-90 day onboarding playbook for Sales Development Representatives. Includes ramp schedules, training modules, and success metrics.',
    type: 'PLAYBOOK',
    tags: ['Sales', 'Training', 'Hiring'],
    status: 'PUBLISHED',
    isFeatured: true,
    storagePath: 'playbooks/sdr-onboarding-playbook.pdf',
    fileSize: 2500000,
    mimeType: 'application/pdf',
    author: 'Revenue Council Team',
  },
  {
    title: 'Revenue Operations SOP',
    description: 'Standard operating procedures for revenue operations teams. Covers data hygiene, reporting cadences, and cross-functional processes.',
    type: 'SOP',
    tags: ['Metrics', 'Strategy'],
    status: 'PUBLISHED',
    isFeatured: false,
    storagePath: 'sops/revops-sop.pdf',
    fileSize: 1800000,
    mimeType: 'application/pdf',
    author: 'Revenue Council Team',
  },
  {
    title: 'Sales Leadership Course - Module 1',
    description: 'First module of our sales leadership development course. Covers coaching fundamentals and performance management.',
    type: 'COURSE',
    tags: ['Leadership', 'Training'],
    status: 'PUBLISHED',
    isFeatured: false,
    storagePath: 'courses/sales-leadership-m1.mp4',
    fileSize: 150000000,
    mimeType: 'video/mp4',
    author: 'Revenue Council Team',
  },
  {
    title: 'KPI Dashboard Template',
    description: 'Customizable dashboard template for tracking key sales and revenue metrics. Works with common BI tools.',
    type: 'TEMPLATE',
    tags: ['Metrics', 'Templates'],
    status: 'PUBLISHED',
    isFeatured: false,
    storagePath: 'templates/kpi-dashboard.xlsx',
    fileSize: 120000,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    author: 'Revenue Council Team',
  },
  {
    title: 'Interview Scorecard Template',
    description: 'Standardized scorecard for evaluating sales candidates. Includes behavioral and competency-based criteria.',
    type: 'TEMPLATE',
    tags: ['Hiring', 'Templates'],
    status: 'PUBLISHED',
    isFeatured: false,
    storagePath: 'templates/interview-scorecard.xlsx',
    fileSize: 35000,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    author: 'Revenue Council Team',
  },
  {
    title: 'Q2 2026 Strategy Guide',
    description: 'Upcoming strategic planning guide for Q2 2026. Will be published at the start of Q2.',
    type: 'PLAYBOOK',
    tags: ['Strategy', 'Leadership'],
    status: 'SCHEDULED',
    isFeatured: false,
    publishAt: new Date('2026-04-01'),
    storagePath: 'playbooks/q2-2026-strategy.pdf',
    fileSize: 3200000,
    mimeType: 'application/pdf',
    author: 'Revenue Council Team',
  },
  {
    title: 'Enterprise Sales Playbook (DRAFT)',
    description: 'Work in progress playbook for enterprise sales motions. Not yet ready for publication.',
    type: 'PLAYBOOK',
    tags: ['Sales', 'Strategy'],
    status: 'DRAFT',
    isFeatured: false,
    storagePath: 'playbooks/enterprise-sales-draft.pdf',
    fileSize: 1500000,
    mimeType: 'application/pdf',
    author: 'Revenue Council Team',
  },
];

async function seedTags() {
  console.log('\n--- Seeding Resource Tags ---');

  for (const tagName of TAGS) {
    await prisma.resourceTag.upsert({
      where: { name: tagName },
      update: {},
      create: {
        name: tagName,
        createdBy: 'seed-script',
      },
    });
    console.log(`  ✓ Tag: ${tagName}`);
  }
}

async function seedResources() {
  console.log('\n--- Seeding Resources ---');

  for (const resource of RESOURCES) {
    const existing = await prisma.resource.findFirst({
      where: { title: resource.title },
    });

    if (existing) {
      console.log(`  - ${resource.title} (already exists)`);
      continue;
    }

    await prisma.resource.create({
      data: {
        title: resource.title,
        description: resource.description,
        type: resource.type as 'TEMPLATE' | 'SOP' | 'PLAYBOOK' | 'COURSE' | 'VIDEO',
        tags: resource.tags,
        status: resource.status as 'DRAFT' | 'PUBLISHED' | 'SCHEDULED',
        isFeatured: resource.isFeatured,
        publishAt: resource.publishAt,
        storagePath: resource.storagePath,
        fileSize: resource.fileSize,
        mimeType: resource.mimeType,
        author: resource.author,
        uploadedBy: 'seed-script',
        currentVersion: 1,
      },
    });

    const statusIcon =
      resource.status === 'PUBLISHED' ? '✓' : resource.status === 'SCHEDULED' ? '⏱' : '📝';
    console.log(`  ${statusIcon} ${resource.title} (${resource.type})`);
  }
}

async function printSummary() {
  const counts = await prisma.resource.groupBy({
    by: ['status'],
    _count: { status: true },
  });

  const tagCount = await prisma.resourceTag.count();
  const featuredCount = await prisma.resource.count({ where: { isFeatured: true } });

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    RESOURCES SEEDED');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\n  Tags Created: ${tagCount}`);
  console.log(`  Featured Resources: ${featuredCount}`);
  console.log('\n  By Status:');
  for (const count of counts) {
    console.log(`    - ${count.status}: ${count._count.status}`);
  }
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('\n  NOTE: These are database records only.');
  console.log('  For download testing, upload actual files to Supabase Storage');
  console.log('  at the paths specified in storagePath field.');
  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

async function main() {
  console.log('Starting resource seeding...\n');

  try {
    await seedTags();
    await seedResources();
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
