const mongoose = require('mongoose');

/**
 * A single "Submit My Voice" submission. Kept intentionally minimal and
 * anonymous - we store the anonId (not any real identity), the category
 * chosen, county, and optional free-text note.
 */
const responseSchema = new mongoose.Schema(
  {
    anonId: {
      type: String,
      required: true,
      index: true,
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DailyQuestion',
      required: true,
    },
    category: {
      type: String, // 'cost_of_living', 'water', 'jobs', etc.
      required: true,
      index: true,
    },
    location: {
      county: { code: String, name: String },
      constituency: { code: String, name: String },
      ward: { code: String, name: String },
    },
    note: {
      type: String,
      maxlength: 500,
      default: '',
    },
  },
  { timestamps: true }
);

// One response per user per question (prevents spamming a day's poll)
responseSchema.index({ anonId: 1, questionId: 1 }, { unique: true });

module.exports = mongoose.model('Response', responseSchema);
