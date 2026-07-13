const { Schema, model } = require('mongoose');

const RefreshTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // SHA-256 hash of the opaque refresh token — the raw value is never stored.
    tokenHash: { type: String, required: true, unique: true },
    // Shared across a rotation chain so reuse of a stale token can revoke the whole family.
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByHash: { type: String, default: null },
  },
  { timestamps: true }
);

// Mongo TTL index — expired rows are auto-deleted, no manual cleanup job needed.
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = model('RefreshToken', RefreshTokenSchema);
