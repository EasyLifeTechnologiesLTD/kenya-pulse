// src/models/Location.js
const mongoose = require('mongoose');

const LocationSchema = new mongoose.Schema({
  code: { type: String, required: true }, // no longer globally unique
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ['county', 'constituency', 'ward'],
    required: true,
    index: true,
  },
  parentCode: {
    type: String,
    default: null,
    index: true,
  },
});

// uniqueness is scoped to type, not global
LocationSchema.index({ type: 1, code: 1 }, { unique: true });
LocationSchema.index({ type: 1, parentCode: 1 });

module.exports = mongoose.model('Location', LocationSchema);