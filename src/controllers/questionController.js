const DailyQuestion = require("../models/DailyQuestion");
const { asyncHandler } = require("../utils/asyncHandler");
const questionAdminService = require('../services/questionAdminService');
const { ApiError } = require('../utils/ApiError');


const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// GET /api/questions/today
// Powers the "Today's Question" card + any bonus questions on the Home Dashboard.
const getTodaysQuestions = asyncHandler(async (req, res) => {
  let questions = await DailyQuestion.find({
    date: { $gte: startOfToday() },
    active: true,
  }).sort({ isPrimary: -1, date: -1 }); // primary first, then newest

  if (questions.length === 0) {
    const template = await DailyQuestion.findOne().sort({ _id: 1 });
    if (template) {
      const todaysCopy = await DailyQuestion.create({
        ...template.toObject(),
        _id: undefined,
        date: new Date(),
        isPrimary: true,
      });
      questions = [todaysCopy];
    }
  }

  // Ensure whichever question is primary has location required,
  // regardless of whether it came from the normal query or the fallback.
  const primary = questions.find((q) => q.isPrimary);
  if (primary) {
    const needsUpdate =
      primary.locationConfig?.county !== 'required' ||
      primary.locationConfig?.constituency !== 'required' ||
      primary.locationConfig?.ward !== 'required';

    if (needsUpdate) {
      primary.locationConfig = {
        county: 'required',
        constituency: 'required',
        ward: 'required',
      };
      await primary.save();
    }
  }

  res.json(questions);
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
  getTodaysQuestions,
  list,
  getOne,
  stats,
  create,
  update,
  remove,
};
