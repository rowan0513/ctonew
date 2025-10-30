const { z } = require('zod');

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

const chatSchema = z.object({
  message: z
    .string()
    .min(1, 'Message is required.')
    .max(4000, 'Message must be under 4000 characters.'),
  model: z.string().max(64).optional()
});

const fileMetadataSchema = z.object({
  description: z.string().max(200).optional()
});

module.exports = {
  userSchema,
  postSchema,
  crawlSchema,
  chatSchema,
  fileMetadataSchema
};
