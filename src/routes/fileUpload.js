const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { validateBody } = require('../middleware/validation');
const { requireWorkspaceAuth } = require('../middleware/workspaceAuth');
const {
  fileUploadRequestSchema,
  fileUploadCompletionSchema
} = require('../schemas');
const { getEnv } = require('../config/env');
const {
  createPendingDocument,
  getDocument,
  markDocumentQueued,
  markDocumentRejected,
  DOCUMENT_STATUSES
} = require('../services/documentStore');
const {
  createPresignedUploadUrl,
  ensureObjectExists,
  generateObjectKey,
  getBucketName,
  getObjectBuffer
} = require('../services/storageService');
const { detectMimeType, isAllowedMimeType, getAllowedMimeTypes } = require('../services/mimeDetector');
const { scanBufferForViruses } = require('../services/virusScanner');
const { scanFile } = require('../services/fileScanner');
const { enqueueDocumentParsing } = require('../queues/documentQueue');

const router = express.Router();

const { UPLOAD_MAX_BYTES } = getEnv();

router.post(
  '/upload-url',
  requireWorkspaceAuth,
  validateBody(fileUploadRequestSchema),
  async (req, res, next) => {
    try {
      const workspace = res.locals.workspace;
      const { fileName, mimeType, sizeBytes, description } = res.locals.bodyValidated;

      if (sizeBytes > UPLOAD_MAX_BYTES) {
        return res.status(400).json({
          error: 'FileTooLarge',
          message: `Files may not exceed ${UPLOAD_MAX_BYTES} bytes.`
        });
      }

      if (!isAllowedMimeType(mimeType)) {
        return res.status(400).json({
          error: 'UnsupportedFileType',
          message: `File type ${mimeType} is not supported. Allowed types: ${getAllowedMimeTypes().join(', ')}.`
        });
      }

      const documentId = uuidv4();
      const s3Key = generateObjectKey({
        workspaceId: workspace.id,
        documentId,
        fileName
      });

      const document = createPendingDocument({
        id: documentId,
        workspaceId: workspace.id,
        fileName,
        description,
        expectedMimeType: mimeType,
        s3Bucket: getBucketName(),
        s3Key
      });

      const signedUpload = await createPresignedUploadUrl({
        key: document.s3Key,
        contentType: mimeType
      });

      res.status(200).json({
        documentId: document.id,
        uploadUrl: signedUpload.uploadUrl,
        headers: signedUpload.headers,
        bucket: document.s3Bucket,
        key: document.s3Key,
        maxBytes: UPLOAD_MAX_BYTES
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/complete',
  requireWorkspaceAuth,
  validateBody(fileUploadCompletionSchema),
  async (req, res, next) => {
    const workspace = res.locals.workspace;
    const { documentId } = res.locals.bodyValidated;

    try {
      const document = getDocument(documentId, workspace.id);

      if (!document) {
        return res.status(404).json({
          error: 'DocumentNotFound',
          message: 'Document could not be located for this workspace.'
        });
      }

      if (document.status !== DOCUMENT_STATUSES.PENDING_UPLOAD) {
        return res.status(409).json({
          error: 'InvalidDocumentState',
          message: `Document is not awaiting upload (current status: ${document.status}).`
        });
      }

      await ensureObjectExists(document.s3Key);

      const { buffer } = await getObjectBuffer(document.s3Key);
      if (buffer.length > UPLOAD_MAX_BYTES) {
        await markDocumentRejected(documentId, workspace.id, 'Uploaded file exceeds configured size limits.');
        return res.status(400).json({
          error: 'FileTooLarge',
          message: `Files may not exceed ${UPLOAD_MAX_BYTES} bytes.`
        });
      }

      const detectedMime = await detectMimeType(buffer, document.fileName);
      if (!detectedMime || !isAllowedMimeType(detectedMime)) {
        await markDocumentRejected(documentId, workspace.id, 'Unsupported MIME type detected.');
        return res.status(400).json({
          error: 'UnsupportedFileType',
          message: `Detected file type ${detectedMime || 'unknown'} is not supported.`
        });
      }

      if (detectedMime !== document.expectedMimeType) {
        await markDocumentRejected(documentId, workspace.id, 'Uploaded file type does not match requested type.');
        return res.status(400).json({
          error: 'MismatchedFileType',
          message: 'Uploaded file type does not match requested type.'
        });
      }

      const virusScan = await scanBufferForViruses(buffer);
      if (!virusScan.clean) {
        await markDocumentRejected(documentId, workspace.id, 'Uploaded file failed antivirus scanning.');
        return res.status(422).json({
          error: 'VirusDetected',
          message: 'Uploaded file failed antivirus scanning.'
        });
      }

      const fileForScanning = {
        originalname: document.fileName,
        mimetype: detectedMime,
        buffer
      };

      const scanResult = await scanFile(fileForScanning, {
        maxBytes: UPLOAD_MAX_BYTES,
        moderationEnabled: process.env.MODERATION_ENABLED === 'true',
        moderationProvider: process.env.MODERATION_PROVIDER
      });

      const statusAfterScan =
        scanResult.status === 'flagged' ? DOCUMENT_STATUSES.NEEDS_REVIEW : DOCUMENT_STATUSES.QUEUED;

      const updatedDocument = await markDocumentQueued(documentId, workspace.id, {
        mimeType: detectedMime,
        sizeBytes: buffer.length,
        hash: scanResult.hash,
        issues: scanResult.issues,
        metadata: {
          moderation: scanResult.moderation
        },
        status: statusAfterScan
      });

      await enqueueDocumentParsing({
        documentId: updatedDocument.id,
        workspaceId: workspace.id
      });

      res.status(202).json({
        documentId: updatedDocument.id,
        status: updatedDocument.status,
        issues: updatedDocument.issues
      });
    } catch (error) {
      if (error.statusCode === 404) {
        return res.status(404).json({
          error: 'StorageObjectNotFound',
          message: 'Uploaded object was not found in storage.'
        });
      }

      next(error);
    }
  }
);

module.exports = router;
