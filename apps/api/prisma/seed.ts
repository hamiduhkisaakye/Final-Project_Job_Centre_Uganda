import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// Demo data lifted straight from the mockups (Stanbic Holdings, Airfield
// Group, Kyagalanyi Foods, Mercy Cares Uganda, Nexus Labs, Uganda Telecom
// Services) so the running app matches the screens on first login.
async function main() {
  const password = await argon2.hash('Password123!');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@jobcentre.ug' },
    update: {},
    create: {
      email: 'admin@jobcentre.ug',
      passwordHash: password,
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  const companies = [
    { name: 'Stanbic Holdings', slug: 'stanbic-holdings', industry: 'Banking & Financial Services', sizeBand: '1,000+', hqLocation: 'Kampala, Uganda', verified: true },
    { name: 'Airfield Group', slug: 'airfield-group', industry: 'Consumer Goods', sizeBand: '200-1,000', hqLocation: 'Kampala, Uganda', verified: true },
    { name: 'Kyagalanyi Foods', slug: 'kyagalanyi-foods', industry: 'FMCG', sizeBand: '200-1,000', hqLocation: 'Jinja, Uganda', verified: false },
    { name: 'Mercy Cares Uganda', slug: 'mercy-cares-uganda', industry: 'NGO & Development', sizeBand: '50-200', hqLocation: 'Gulu, Uganda', verified: false },
    { name: 'Nexus Labs', slug: 'nexus-labs', industry: 'Software', sizeBand: '10-50', hqLocation: 'Remote — Uganda', verified: true },
    { name: 'Uganda Telecom Services', slug: 'uganda-telecom-services', industry: 'Telecommunications', sizeBand: '1,000+', hqLocation: 'Kampala, Uganda', verified: true },
  ];

  const companyRecords: Record<string, any> = {};
  for (const c of companies) {
    const company = await prisma.company.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        name: c.name,
        slug: c.slug,
        industry: c.industry,
        sizeBand: c.sizeBand,
        hqLocation: c.hqLocation,
        about: `${c.name} is a growing employer on Job Centre Uganda.`,
        verificationStatus: c.verified ? 'VERIFIED' : 'PENDING',
        salaryTransparencyVerified: c.verified,
        plan: c.verified ? 'PREMIUM' : 'FREE',
      },
    });
    companyRecords[c.slug] = company;

    const ownerEmail = `owner@${c.slug.replace(/-/g, '')}.ug`;
    const owner = await prisma.user.upsert({
      where: { email: ownerEmail },
      update: {},
      create: { email: ownerEmail, passwordHash: password, role: 'COMPANY', status: 'ACTIVE', emailVerifiedAt: new Date() },
    });
    await prisma.companyMember.upsert({
      where: { companyId_userId: { companyId: company.id, userId: owner.id } },
      update: {},
      create: { companyId: company.id, userId: owner.id, memberRole: 'OWNER' },
    });
  }

  const jobs = [
    { slug: 'stanbic-holdings', title: 'Senior Marketing Officer', category: 'Sales & Marketing', location: 'Kampala', type: 'FULL_TIME', min: 4500000, max: 6000000, disclosed: true, skills: ['Brand strategy', 'Campaign management', 'Media planning', 'Budget ownership'] },
    { slug: 'stanbic-holdings', title: 'Relationship Manager — SME', category: 'Sales & Marketing', location: 'Mbarara', type: 'FULL_TIME', min: 5200000, max: 6800000, disclosed: true, skills: ['Client relationship management', 'SME lending'] },
    { slug: 'airfield-group', title: 'Digital Marketing Lead', category: 'Sales & Marketing', location: 'Kampala', type: 'FULL_TIME', min: 5000000, max: 7200000, disclosed: true, skills: ['Paid media', 'Lifecycle marketing', 'Team leadership'] },
    { slug: 'kyagalanyi-foods', title: 'Trade Marketing Executive', category: 'Sales & Marketing', location: 'Kampala', type: 'FULL_TIME', min: 3800000, max: 4600000, disclosed: true, skills: ['Trade marketing', 'Dealer engagement'] },
    { slug: 'kyagalanyi-foods', title: 'Warehouse Supervisor', category: 'Logistics', location: 'Jinja', type: 'FULL_TIME', min: 1800000, max: 2400000, disclosed: true, skills: ['Inventory management', 'Team supervision'] },
    { slug: 'mercy-cares-uganda', title: 'Programme Officer — WASH', category: 'NGO & Development', location: 'Gulu', type: 'FULL_TIME', min: 3200000, max: 4100000, disclosed: false, skills: ['M&E', 'Donor reporting'] },
    { slug: 'mercy-cares-uganda', title: 'Communications Officer', category: 'NGO & Development', location: 'Kampala', type: 'FULL_TIME', min: 3000000, max: 3800000, disclosed: false, skills: ['Storytelling', 'Media relations'] },
    { slug: 'nexus-labs', title: 'Backend Engineer (Node.js)', category: 'IT & Software', location: 'Remote — Uganda', type: 'REMOTE', min: 6000000, max: 8500000, disclosed: true, skills: ['Node.js', 'Postgres', 'REST APIs'] },
    { slug: 'nexus-labs', title: 'Growth Marketer (Remote)', category: 'Sales & Marketing', location: 'Remote — Uganda', type: 'REMOTE', min: 5500000, max: 7000000, disclosed: true, skills: ['Campaign analytics', 'SQL basics'] },
    { slug: 'uganda-telecom-services', title: 'Marketing Officer — Trade', category: 'Sales & Marketing', location: 'Kampala', type: 'FULL_TIME', min: 3400000, max: 4200000, disclosed: true, skills: ['Trade activations', 'Market intelligence'] },
  ];

  for (const j of jobs) {
    const company = companyRecords[j.slug];
    const slug = j.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + company.slug;
    await prisma.job.upsert({
      where: { slug },
      update: {},
      create: {
        companyId: company.id,
        title: j.title,
        slug,
        description: `${company.name} is hiring a ${j.title} to join our team in ${j.location}. This is a great opportunity to grow your career with a leading employer on Job Centre Uganda.`,
        responsibilities: [`Own day-to-day delivery for the ${j.title} function`, 'Collaborate cross-functionally with product, ops and finance', 'Report on outcomes monthly'],
        requirements: [`Relevant degree or equivalent experience`, `2+ years in a similar ${j.category} role`],
        employmentType: j.type as any,
        seniority: 'Mid-level',
        category: j.category,
        location: j.location,
        salaryMin: j.min,
        salaryMax: j.max,
        salaryDisclosed: j.disclosed,
        salaryVerifiedAt: j.disclosed && company.verificationStatus === 'VERIFIED' ? new Date() : null,
        skills: j.skills,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
  }

  const seeker = await prisma.user.upsert({
    where: { email: 'sarah.nakato@example.com' },
    update: {},
    create: { email: 'sarah.nakato@example.com', passwordHash: password, role: 'JOB_SEEKER', status: 'ACTIVE', emailVerifiedAt: new Date() },
  });
  await prisma.seekerProfile.upsert({
    where: { userId: seeker.id },
    update: { fullName: 'Sarah Nakato' },
    create: {
      userId: seeker.id,
      fullName: 'Sarah Nakato',
      headline: 'Marketing Officer',
      about: 'Marketing professional with six years in FMCG and trade marketing across Uganda.',
      location: 'Kampala',
      yearsExperience: 6,
      expectedSalaryMin: 4000000,
      expectedSalaryMax: 6000000,
      skills: ['Brand strategy', 'Trade marketing', 'Campaign management', 'Budget ownership'],
      resumeText: 'Marketing Officer at Kyagalanyi Foods since 2021, leading regional trade marketing.',
      profileStrength: 72,
    },
  });

  console.log('Seed complete. Demo logins (password: Password123!):');
  console.log('  Admin:   admin@jobcentre.ug');
  console.log('  Company: owner@stanbicholdings.ug (and others per company slug)');
  console.log('  Seeker:  sarah.nakato@example.com');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
