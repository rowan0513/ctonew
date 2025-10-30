const { z } = require('zod');
const { getEnv } = require('../config/env');
const { getAllowedMimeTypes } = require('../services/mimeDetector');

const userSchema = z.object({
  name: z.string().min(1, 'Name is required.').max(100, 'Name must be under 100 characters.'),
  email: z.string().email('Email must be valid.'),
  bio: z.string().max(2000, 'Bio must be under 2000 characters.').optional(),
  website: z.string().url('Website must be a valid URL.').optional()
});

const postSchema = z.object({
  title: z.string().min(3, 'Title must contain at least 3 characters.').max(200, 'Title must be under 200 characters.'),
  content: z.string().min(1, 'Content is required.'),
  tags: z.array(z.string().min(1).max(30)).max(10).optional()
});

const crawlSchema = z.object({
  url: z.string().url('URL must be valid.')
});

const fileMetadataSchema = z.object({
  description: z.string().max(200).optional()
});

const { UPLOAD_MAX_BYTES } = getEnv();
const allowedMimeTypes = getAllowedMimeTypes();

const fileUploadRequestSchema = z.object({
  fileName: z.string().min(1, 'File name is required.').max(255, 'File name must be under 255 characters.'),
  mimeType: z
    .string()
    .refine((value) => allowedMimeTypes.includes(value), {
      message: 'File type is not supported.'
    }),
  sizeBytes: z
    .number({ invalid_type_error: 'File size must be a number.' })
    .int('File size must be an integer.')
    .positive('File size must be positive.')
    .max(UPLOAD_MAX_BYTES, `File size must be below ${UPLOAD_MAX_BYTES} bytes.`),
  description: z.string().max(200).optional()
});

const fileUploadCompletionSchema = z.object({
  documentId: z.string().uuid('Document identifier must be a valid UUID.')
});

module.exports = {
  userSchema,
  postSchema,
  crawlSchema,
  fileMetadataSchema,
  fileUploadRequestSchema,
  fileUploadCompletionSchema
};
