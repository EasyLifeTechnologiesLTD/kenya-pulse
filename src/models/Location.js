const mongoose = require('mongoose');

const LocationSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
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
    // null for counties; county code for constituencies; constituency code for wards
  },
});

LocationSchema.index({ type: 1, parentCode: 1 });

module.exports = mongoose.model('Location', LocationSchema);