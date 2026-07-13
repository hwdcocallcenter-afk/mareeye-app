const { Schema, model } = require('mongoose');

const DiagnosisHistorySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mode: { type: String, enum: ['leaf', 'soil'], required: true },
    cropName: { type: String, default: null },
    cropEmoji: { type: String, default: null },
    title: { type: String, required: true },
    cls: { type: String, enum: ['ok', 'warn', 'sick'], required: true },
    badge: { type: String, default: '' },
    // Raw AI result JSON (LeafResult/SoilResult shape from the Flutter client) —
    // stored as-is since its fields have already evolved across phases.
    result: { type: Schema.Types.Mixed, required: true },
    favorite: { type: Boolean, default: false },
    scannedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

DiagnosisHistorySchema.index({ user: 1, createdAt: -1 });

module.exports = model('DiagnosisHistory', DiagnosisHistorySchema);
