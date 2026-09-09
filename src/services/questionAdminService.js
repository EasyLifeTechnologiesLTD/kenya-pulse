// src/services/questionAdminService.js
const DailyQuestion = require('../models/DailyQuestion');
const Response = require('../models/Response');
const { ApiError } = require('../utils/ApiError');

function toMidnightUTC(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Invalid date');
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function todayUTC() {
  return toMidnightUTC(new Date());
}

function deriveStatus(scheduledFor) {
  const today = todayUTC();
  const d = new Date(scheduledFor);
  d.setUTCHours(0, 0, 0, 0);
  if (d.getTime() > today.getTime()) return 'SCHEDULED';
  if (d.getTime() === today.getTime()) return 'ACTIVE';
  return 'PAST';
}

async function listQuestions({ page = 1, limit = 25, status, search }) {
  const filter = {};
  const today = todayUTC();

  if (status === 'SCHEDULED') filter.date = { $gt: today };
  else if (status === 'ACTIVE') filter.date = today;
  else if (status === 'PAST') filter.date = { $lt: today };

  if (search) filter.text = new RegExp(escapeRegex(search), 'i');

  const skip = (Math.max(1, page) - 1) * limit;

  const [docs, total] = await Promise.all([
    DailyQuestion.find(filter).sort({ date: -1 }).skip(skip).limit(limit),
    DailyQuestion.countDocuments(filter),
  ]);

  const data = docs.map((q) => ({ ...q.toObject(), status: deriveStatus(q.date) }));
  return { data, total };
}

async function getQuestionById(id) {
  const q = await DailyQuestion.findById(id);
  if (!q) return null;
  return { ...q.toObject(), status: deriveStatus(q.date) };
}

async function createQuestion({ text, categoryOptions, scheduledFor }, adminId) {
  const normalizedDate = toMidnightUTC(scheduledFor);

  const existing = await DailyQuestion.findOne({ date: normalizedDate });
  if (existing) throw new ApiError(409, 'A question is already scheduled for that date');

  const question = await DailyQuestion.create({
    text,
    categoryOptions,
    date: normalizedDate,
    createdByAdmin: adminId,
  });

  return { ...question.toObject(), status: deriveStatus(question.date) };
}

async function updateQuestion(id, updates) {
  const question = await DailyQuestion.findById(id);
  if (!question) return null;

  if (deriveStatus(question.date) === 'PAST') {
    throw new ApiError(400, 'Cannot edit a question that has already run');
  }

  if (updates.text !== undefined) question.text = updates.text;
  if (updates.categoryOptions !== undefined) question.categoryOptions = updates.categoryOptions;
  if (updates.date !== undefined) {
    const normalizedDate = toMidnightUTC(updates.date);
    const clash = await DailyQuestion.findOne({ date: normalizedDate, _id: { $ne: id } });
    if (clash) throw new ApiError(409, 'A question is already scheduled for that date');
    question.date = normalizedDate;
  }
  if (updates.active !== undefined) question.active = updates.active;

  await question.save();
  return { ...question.toObject(), status: deriveStatus(question.date) };
}

async function deleteQuestion(id) {
  const question = await DailyQuestion.findById(id);
  if (!question) return null;

  if (deriveStatus(question.date) !== 'SCHEDULED') {
    throw new ApiError(400, 'Only future (not yet active) questions can be deleted');
  }

  await question.deleteOne();
  return true;
}

async function getQuestionStats(id) {
  const question = await DailyQuestion.findById(id);
  if (!question) return null;

  const [byCategory, byCounty, total] = await Promise.all([
    Response.aggregate([
      { $match: { question: question._id } },
      { $group: { _id: '$categoryKey', count: { $sum: 1 } } },
    ]),
    Response.aggregate([
      { $match: { question: question._id } },
      { $group: { _id: '$county', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
    Response.countDocuments({ question: question._id }),
  ]);

  const categoryCounts = Object.fromEntries(byCategory.map((r) => [r._id, r.count]));

  const byCategoryWithLabels = question.categoryOptions.map((opt) => ({
    key: opt.key,
    label: opt.label,
    count: categoryCounts[opt.key] || 0,
    percent: total > 0 ? Math.round(((categoryCounts[opt.key] || 0) / total) * 1000) / 10 : 0,
  }));

  return {
    questionId: question._id,
    text: question.text,
    date: question.date,
    totalResponses: total,
    byCategory: byCategoryWithLabels,
    byCounty: byCounty.map((r) => ({ county: r._id || '(unknown)', count: r.count })),
  };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  listQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getQuestionStats,
};
