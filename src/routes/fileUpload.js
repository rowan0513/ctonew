const express = require('express');
const multer = require('multer');
const { validateBody } = require('../middleware/validation');
const { fileMetadataSchema } = require('../schemas');
const { scanFile } = require('../services/fileScanner');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.UPLOAD_MAX_BYTES || 5 * 1024 * 1024)
  }
});

router.post(
  '/',
  upload.single('file'),
  validateBody(fileMetadataSchema),
  async (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({ error: 'ValidationError', message: 'File is required.' });
    }

    try {
      const metadata = res.locals.bodyValidated || {};
      const scanResult = await scanFile(req.file, {
        moderationEnabled: process.env.MODERATION_ENABLED === 'true',
        moderationProvider: process.env.MODERATION_PROVIDER
      });

      res.status(200).json({
        file: {
          name: scanResult.fileName,
          mimeType: scanResult.mimeType,
          size: scanResult.size,
          hash: scanResult.hash,
          description: metadata.description
        },
        status: scanResult.status,
        issues: scanResult.issues,
        moderation: scanResult.moderation
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
