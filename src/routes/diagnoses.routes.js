const express = require('express');
const { body, query, validationResult } = require('express-validator');

const DiagnosisHistory = require('../models/DiagnosisHistory');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

function validateRequest(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(400).json({ error: result.array()[0].msg });
  }
  next();
}

async function loadOwnedRecord(req, res, next) {
  try {
    const record = await DiagnosisHistory.findOne({ _id: req.params.id, user: req.userId });
    if (!record) return res.status(404).json({ error: 'Diiwaanka lama helin.' });
    req.record = record;
    next();
  } catch (_e) {
    res.status(404).json({ error: 'Diiwaanka lama helin.' });
  }
}

// --- POST /api/diagnoses ---
router.post(
  '/',
  [
    body('mode').isIn(['leaf', 'soil']).withMessage('mode waa inuu ahaadaa leaf ama soil'),
    body('title').trim().notEmpty().withMessage('title waa loo baahan yahay'),
    body('cls').isIn(['ok', 'warn', 'sick']).withMessage('cls waa inuu ahaadaa ok, warn, ama sick'),
    body('result').exists().withMessage('result waa loo baahan yahay'),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { mode, cropName, cropEmoji, title, cls, badge, result, scannedAt, favorite } = req.body;
      const record = await DiagnosisHistory.create({
        user: req.userId,
        mode,
        cropName: cropName ?? null,
        cropEmoji: cropEmoji ?? null,
        title,
        cls,
        badge: badge ?? '',
        result,
        favorite: favorite ?? false,
        scannedAt: scannedAt ? new Date(scannedAt) : undefined,
      });
      res.status(201).json({ record });
    } catch (e) {
      next(e);
    }
  }
);

// --- GET /api/diagnoses ---
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page waa inuu ahaadaa lambar'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit waa 1-100'),
    query('mode').optional().isIn(['leaf', 'soil']),
    query('favorite').optional().isIn(['true', 'false']),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 20);
      const filter = { user: req.userId };
      if (req.query.mode) filter.mode = req.query.mode;
      if (req.query.favorite) filter.favorite = req.query.favorite === 'true';

      const [items, total] = await Promise.all([
        DiagnosisHistory.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        DiagnosisHistory.countDocuments(filter),
      ]);

      res.json({ items, page, limit, total });
    } catch (e) {
      next(e);
    }
  }
);

// --- GET /api/diagnoses/:id ---
router.get('/:id', loadOwnedRecord, (req, res) => {
  res.json({ record: req.record });
});

// --- PATCH /api/diagnoses/:id ---
router.patch(
  '/:id',
  loadOwnedRecord,
  [body('favorite').isBoolean().withMessage('favorite waa inuu ahaadaa true/false')],
  validateRequest,
  async (req, res, next) => {
    try {
      req.record.favorite = req.body.favorite;
      await req.record.save();
      res.json({ record: req.record });
    } catch (e) {
      next(e);
    }
  }
);

// --- DELETE /api/diagnoses/:id ---
router.delete('/:id', loadOwnedRecord, async (req, res, next) => {
  try {
    await req.record.deleteOne();
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
