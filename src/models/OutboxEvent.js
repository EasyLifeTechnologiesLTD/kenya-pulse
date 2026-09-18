// models/OutboxEvent.js
const mongoose = require('mongoose');

const outboxEventSchema = new mongoose.Schema(
  {
    aggregateType: {
      type: String, // 'Response', and later maybe others
      required: true,
      index: true,
    },
    aggregateId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    eventType: {
      type: String, // 'response.created'
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'failed'],
      default: 'pending',
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastError: {
      type: String,
      default: null,
    },
    nextAttemptAt: {
      type: Date,
      default: () => new Date(), // ready immediately
      index: true,
    },
    sentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Worker polls on (status, nextAttemptAt) together.
outboxEventSchema.index({ status: 1, nextAttemptAt: 1 });

module.exports = mongoose.model('OutboxEvent', outboxEventSchema);