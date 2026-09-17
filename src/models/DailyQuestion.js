const mongoose = require('mongoose');

const dailyQuestionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    categoryOptions: [
      {
        key: String, // 'cost_of_living', 'jobs', 'water', etc.
        label: String,
        icon: String, // emoji or icon name for the UI
      },
    ],
    active: {
      type: Boolean,
      default: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    locationConfig: {
      county: { type: String, enum: ['required', 'optional', 'hidden'], default: 'hidden' },
      constituency: { type: String, enum: ['required', 'optional', 'hidden'], default: 'hidden' },
      ward: { type: String, enum: ['required', 'optional', 'hidden'], default: 'hidden' },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DailyQuestion', dailyQuestionSchema);
