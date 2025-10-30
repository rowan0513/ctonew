const { z } = require('zod');

const phonePattern = /^[0-9+().\-\s]{7,}$/;

const userSchema = z.object({
  name: z.string().min(1, 'Name is required.').max(100, 'Name must be under 100 characters.'),
  email: z.string().email('Email must be valid.'),
  bio: z.string().max(2000, 'Bio must be under 2000 characters.').optional(),
  website: z.string().url('Website must be a valid URL.').optional(),
  phone: z.string().regex(phonePattern, 'Phone number must be valid.').optional()
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

const privacyToggleSchema = z.object({
  enabled: z.boolean()
});

const workspaceParamsSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required.')
});

const workspaceDataSourceParamsSchema = workspaceParamsSchema.extend({
  dataSourceId: z.string().min(1, 'Data source ID is required.')
});

const dataSourceDocumentSchema = z.object({
  id: z.string().min(1, 'Document ID is required.'),
  content: z.string().min(1, 'Content is required.')
});

const dataSourceChunkSchema = z.object({
  id: z.string().min(1, 'Chunk ID is required.'),
  content: z.string().min(1, 'Content is required.')
});

const dataSourceEmbeddingSchema = z.object({
  id: z.string().min(1, 'Embedding ID is required.'),
  vector: z.array(z.number()).min(1, 'Embedding vector must include at least one number.')
});

const dataSourceIndexSchema = z.object({
  name: z.string().min(1, 'Index name is required.'),
  ready: z.boolean().optional()
});

const dataSourceSchema = z.object({
  id: z.string().min(1, 'Data source ID is required.'),
  originalFile: z
    .object({
      key: z.string().min(1, 'File key is required.'),
      location: z.string().url('File location must be a valid URL.')
    })
    .nullable()
    .optional(),
  parsedDocuments: z.array(dataSourceDocumentSchema).optional(),
  chunks: z.array(dataSourceChunkSchema).optional(),
  embeddings: z.array(dataSourceEmbeddingSchema).optional(),
  indices: z.array(dataSourceIndexSchema).optional()
});

module.exports = {
  userSchema,
  postSchema,
  crawlSchema,
  fileMetadataSchema,
  privacyToggleSchema,
  workspaceParamsSchema,
  workspaceDataSourceParamsSchema,
  dataSourceSchema
};
