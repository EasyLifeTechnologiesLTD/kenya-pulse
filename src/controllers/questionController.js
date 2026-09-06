const DailyQuestion = require("../models/DailyQuestion");
const { asyncHandler } = require("../utils/asyncHandler");

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

const list = async () => {
  // TODO: implement/delete
};
const getOne = async () => {
  // TODO: implement/delete
};
const stats = async () => {
  // TODO: implement/delete
};
const create = async () => {
  // TODO: implement/delete
};
const update = async () => {
  // TODO: implement/delete
};
const remove = async () => {
  // TODO: implement/delete
};

module.exports = {
  getTodaysQuestion,
  list,
  getOne,
  stats,
  create,
  update,
  remove,
};
