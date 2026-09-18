const Response = require('../models/Response');
const DailyQuestion = require('../models/DailyQuestion');
const { asyncHandler } = require('../utils/asyncHandler');

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

// POST /api/responses
// The "Submit My Voice" action.
const submitResponse = asyncHandler(async (req, res) => {
  const { questionId, category, note, location } = req.body;
  const user = req.user;

  const question = await DailyQuestion.findById(questionId);
  if (!question) {
    return res.status(404).json({ message: 'Question not found' });
  }

  const response = await Response.create({
    anonId: user.anonId,
    questionId,
    category,
    note,
    location: {
      county: location?.county ?? (user.county ? { code: user.county } : null),
      constituency: location?.constituency ?? null,
      ward: location?.ward ?? null,
    },
  });

  updateStreakAndAchievements(user);
  await user.save();

  res.status(201).json({
    response,
    streak: user.streak,
    newAchievements: user.achievements.slice(-1), // most recently pushed, if any
  });
});

module.exports = { submitResponse };
