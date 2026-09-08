// scripts/seed.js


require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const KENYA_COUNTIES = require('../src/utils/kenyaCounties');
const bcrypt = require('bcryptjs');
const env = require('../src/config/env');
const AdminUser = require('../src/models/AdminUser');

const County = require('../src/models/County');
const DailyQuestion = require('../src/models/DailyQuestion');
const MoodSnapshot = require('../src/models/MoodSnapshot');
const CommunityPost = require('../src/models/CommunityPost');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach((arg, i, arr) => {
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = arr[i + 1];
      args[key] = value;
    }
  });
  return args;
}

// A few counties get richer seed data (matching the mockups) so the app
// has something interesting to show out of the box. Everything else in
// KENYA_COUNTIES gets inserted with a neutral default score of 50 - the
// aggregation job (utils/aggregateMood.js) will start giving them real
// numbers as soon as citizens submit responses in those counties.
const FEATURED = {
  'Kisumu County': {
    moodScore: 61,
    sentiment: 'neutral',
    topIssues: [
      { category: 'Water', percentage: 42 },
      { category: 'Healthcare', percentage: 28 },
      { category: 'Jobs', percentage: 16 },
    ],
    aiSummary:
      'Water access concerns increased by 24% this week. Healthcare availability remains a major issue in rural areas.',
  },
  'Nairobi County': { moodScore: 64, sentiment: 'neutral' },
  'Mombasa County': { moodScore: 70, sentiment: 'positive' },
  'Nakuru County': { moodScore: 52, sentiment: 'neutral' },
};

async function seedAdmin() {
  const { email, password } = parseArgs();

  if (!email || !password) {
    console.error('Usage: npm run seed:superadmin -- --email you@masauti.app --password Temp1234!');
    process.exit(1);
  }

  const existing = await AdminUser.findOne({ email: email.toLowerCase() });
  if (existing) {
    console.error(`An admin with email ${email} already exists.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);

  const admin = await AdminUser.create({
    email: email.toLowerCase(),
    passwordHash,
    role: 'SUPER_ADMIN',
    mustChangePassword: true,
    mfaEnabled: false,
    active: true,
  });

  console.log(`Created SUPER_ADMIN ${admin.email} (id: ${admin._id})`);
  console.log('They will be prompted to set up MFA and change their password on first login.');
}

const run = async () => {
  await connectDB();

  await Promise.all([
    County.deleteMany({}),
    DailyQuestion.deleteMany({}),
    MoodSnapshot.deleteMany({}),
    CommunityPost.deleteMany({}),
  ]);

  await seedAdmin();

  const counties = KENYA_COUNTIES.map((name) => ({
    name,
    ...(FEATURED[name] ?? { moodScore: 50, sentiment: 'neutral' }),
  }));

  await County.insertMany(counties);

  // Kisumu's sub-county breakdown, shown on the My County screen.
  await County.insertMany([
    { name: 'Kisumu Central', parentCounty: 'Kisumu County', moodScore: 68, sentiment: 'positive' },
    { name: 'Kisumu East', parentCounty: 'Kisumu County', moodScore: 58, sentiment: 'neutral' },
    { name: 'Kisumu West', parentCounty: 'Kisumu County', moodScore: 63, sentiment: 'positive' },
    { name: 'Nyando', parentCounty: 'Kisumu County', moodScore: 55, sentiment: 'neutral' },
  ]);

  await DailyQuestion.create({
    text: 'What is the biggest challenge affecting your community today?',
    date: new Date(),
    categoryOptions: [
      { key: 'cost_of_living', label: 'Cost of Living', icon: '💰' },
      { key: 'jobs', label: 'Jobs', icon: '💼' },
      { key: 'water', label: 'Water', icon: '💧' },
      { key: 'healthcare', label: 'Healthcare', icon: '🏥' },
      { key: 'education', label: 'Education', icon: '🎓' },
      { key: 'roads', label: 'Roads', icon: '🚧' },
      { key: 'security', label: 'Security', icon: '🚔' },
      { key: 'agriculture', label: 'Agriculture', icon: '🌱' },
      { key: 'electricity', label: 'Electricity', icon: '⚡' },
    ],
  });

  await MoodSnapshot.create({
    date: new Date(),
    nationalMoodScore: 68,
    changeFromPrevious: 3,
    trending: [
      { category: 'Cost of Living', percentage: 38, changePercentagePoints: 6 },
      { category: 'Water', percentage: 22, changePercentagePoints: 12 },
      { category: 'Jobs', percentage: 18, changePercentagePoints: -2 },
    ],
    aiDailySummary:
      'Citizens across Kenya continue to rank the cost of living as their biggest concern. Water shortages are rapidly increasing in western counties.',
  });

  await CommunityPost.insertMany([
    { anonId: 'seed-1', county: 'Kisumu East', text: 'Many residents report unreliable water supply.', category: 'Water', agreeCount: 348 },
    { anonId: 'seed-2', county: 'Nairobi West', text: 'Youth employment opportunities remain limited.', category: 'Jobs', agreeCount: 612 },
    { anonId: 'seed-3', county: 'Nakuru Town East', text: 'The high cost of basic commodities is affecting families.', category: 'Cost of Living', agreeCount: 523 },
    { anonId: 'seed-4', county: 'Mombasa County', text: 'Good progress in waste collection and environmental cleanliness.', category: 'Environment', agreeCount: 287 },
  ]);

  console.log('Seed data inserted.');
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
