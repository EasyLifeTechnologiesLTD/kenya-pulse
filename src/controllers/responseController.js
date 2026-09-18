const Response = require('../models/Response');
const DailyQuestion = require('../models/DailyQuestion');
const { asyncHandler } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');
const OutboxEvent = require('../models/OutboxEvent');

const ACHIEVEMENTS = {
  COMMUNITY_VOICE: {
    key: 'community_voice',
    title: 'Community Voice',
    description: 'You actively share insights that help your community.',
  },
  ACTIVE_CITIZEN: {
    key: 'active_citizen',
    title: 'Active Citizen',
    description: 'You participate regularly in building a better Kenya.',
  },
  THIRTY_DAY_CONTRIBUTOR: {
    key: '30_day_contributor',
    title: '30-Day Contributor',
    description: "You've contributed for 30 days. Keep it up!",
  },
};

const isYesterday = (date, today) => {
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toDateString() === yesterday.toDateString();
};

const updateStreakAndAchievements = (user) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last = user.streak.lastResponseDate;

  if (!last) {
    user.streak.current = 1;
  } else if (last.toDateString() === today.toDateString()) {
    // Already responded today, no-op (shouldn't reach here due to unique index)
    return;
  } else if (isYesterday(last, today)) {
    user.streak.current += 1;
  } else {
    user.streak.current = 1; // streak broken, restart
  }

  user.streak.lastResponseDate = today;
  user.streak.longest = Math.max(user.streak.longest, user.streak.current);
  user.totalResponses += 1;

  // Append to rolling 7-day activity strip
  user.streak.last7Days.push({ date: today, completed: true });
  if (user.streak.last7Days.length > 7) user.streak.last7Days.shift();

  const earnedKeys = new Set(user.achievements.map((a) => a.key));
  const grant = (a) => {
    if (!earnedKeys.has(a.key)) {
      user.achievements.push({ ...a, earnedAt: new Date() });
    }
  };

  if (user.totalResponses >= 1) grant(ACHIEVEMENTS.COMMUNITY_VOICE);
  if (user.streak.current >= 7) grant(ACHIEVEMENTS.ACTIVE_CITIZEN);
  if (user.streak.current >= 30) grant(ACHIEVEMENTS.THIRTY_DAY_CONTRIBUTOR);
};

const buildLocationSignature = (location) =>
  [
    location?.county?.code ?? '',
    location?.constituency?.code ?? '',
    location?.ward?.code ?? '',
  ].join('|');

// POST /api/responses
// The "Submit My Voice" action.
const submitResponse = asyncHandler(async (req, res) => {
  const { questionId, category, note, location } = req.body;
  const user = req.user;

  const question = await DailyQuestion.findById(questionId);
  if (!question) {
    return res.status(404).json({ message: 'Question not found' });
  }

  const OLD_INDEX_NAMES = [
    'anonId_1_questionId_1',
    'anonId_1_questionId_1_location.county.code_1_location.constituency.code_1_location.ward.code_1',
  ];

  const existingIndexes = await Response.collection.indexes();
  console.log('Existing indexes:', existingIndexes.map((i) => i.name));

  for (const name of OLD_INDEX_NAMES) {
    const exists = existingIndexes.some((i) => i.name === name);
    if (!exists) {
      console.log(`Skipping "${name}" — not present`);
      continue;
    }
    try {
      await Response.collection.dropIndex(name);
      console.log(`Dropped index "${name}"`);
    } catch (err) {
      console.error(`Failed to drop index "${name}":`, err.message);
    }
  }

  // Creates any index declared in the current schema that's missing,
  // and drops any index on the collection that's no longer in the schema
  // (excluding the default _id index).
  const syncResult = await Response.syncIndexes();
  console.log('syncIndexes result:', syncResult);

  const resolvedLocation = {
    county: location?.county ?? (user.county ? { code: user.county } : null),
    constituency: location?.constituency ?? null,
    ward: location?.ward ?? null,
  };

  const locationSignature = buildLocationSignature(resolvedLocation);

  const duplicate = await Response.findOne({
    anonId: user.anonId,
    questionId,
    locationSignature,
    category,
  });

  if (duplicate) {
    throw new ApiError(409, 'You have already responded to this question for this location.');
  }

  const session = await mongoose.startSession();
  let response;

  try {
    await session.withTransaction(async () => {
      const created = await Response.create(
        [
          {
            anonId: user.anonId,
            questionId,
            category,
            note,
            location: resolvedLocation,
            locationSignature,
          },
        ],
        { session }
      );
      response = created[0];

      await OutboxEvent.create(
        [
          {
            aggregateType: 'Response',
            aggregateId: response._id,
            eventType: 'response.created',
            payload: {
              responseId: response._id,
              questionId: response.questionId,
              questionText: question.text,
              category: response.category,
              location: response.location,
              note: response.note,
              createdAt: response.createdAt,
            },
          },
        ],
        { session }
      );
    });
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(409, 'You have already responded to this question for this location and category.');
    }
    throw err;
  } finally {
    await session.endSession();
  }

  updateStreakAndAchievements(user);
  await user.save();

  res.status(201).json({
    response,
    streak: user.streak,
    newAchievements: user.achievements.slice(-1), // most recently pushed, if any
  });
});

module.exports = { submitResponse };
