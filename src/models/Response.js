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
    locationSignature: {
      type: String,
    },
    note: {
      type: String,
      maxlength: 500,
      default: '',
    },
  },
  { timestamps: true }
);

// One response per user per question per location per category — allows the
// same user to answer the same question from multiple locations, and to
// submit multiple categories for the same question+location, but blocks an
// exact repeat of question+location+category.
responseSchema.index(
  { anonId: 1, questionId: 1, locationSignature: 1, category: 1 },
  { unique: true }
);

module.exports = mongoose.model('Response', responseSchema);