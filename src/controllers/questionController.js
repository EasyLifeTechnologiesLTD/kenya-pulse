const DailyQuestion = require("../models/DailyQuestion");
const { asyncHandler } = require("../utils/asyncHandler");
const questionAdminService = require('../services/questionAdminService');

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// GET /api/questions/today
// Powers the "Today's Question" card on the Home Dashboard.
const getTodaysQuestion = asyncHandler(async (req, res) => {
  const question = await DailyQuestion.findOne({
    date: { $gte: startOfToday() },
    active: true,
  }).sort({ date: -1 });

  if (!question) {
    return res
      .status(404)
      .json({ message: "No active question for today yet." });
  }

  res.json(question);
});

const list = asyncHandler(async (req, res) => {
  const { page, limit, status, search } = req.query;

  const result = await questionAdminService.listQuestions({
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 25,
    status,
    search,
  });

  res.json(result);
});

const getOne = asyncHandler(async (req, res) => {
  const question = await questionAdminService.getQuestionById(req.params.id);
  if (!question) throw new ApiError(404, 'Question not found');
  res.json(question);
});

const create = asyncHandler(async (req, res) => {
  const { text, categoryOptions, scheduledFor } = req.body;

  if (!text || !text.trim()) throw new ApiError(400, 'text is required');
  if (!scheduledFor) throw new ApiError(400, 'scheduledFor is required');
  if (!Array.isArray(categoryOptions) || categoryOptions.length < 2) {
    throw new ApiError(400, 'categoryOptions must have at least 2 options');
  }

  const question = await questionAdminService.createQuestion(
    { text: text.trim(), categoryOptions, scheduledFor },
    req.admin.id,
  );

  res.status(201).json(question);
});

const update = asyncHandler(async (req, res) => {
  const question = await questionAdminService.updateQuestion(req.params.id, req.body);
  if (!question) throw new ApiError(404, 'Question not found');
  res.json(question);
});

const remove = asyncHandler(async (req, res) => {
  const deleted = await questionAdminService.deleteQuestion(req.params.id);
  if (!deleted) throw new ApiError(404, 'Question not found');
  res.json({ success: true });
});

const stats = asyncHandler(async (req, res) => {
  const data = await questionAdminService.getQuestionStats(req.params.id);
  if (!data) throw new ApiError(404, 'Question not found');
  res.json(data);
});


module.exports = {
  getTodaysQuestion,
  list,
  getOne,
  stats,
  create,
  update,
  remove,
};
