const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getEnv } = require('../config/env');

const memoryStore = new Map();
let s3Client;

const streamToBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const sanitizeFileName = (fileName) => fileName.replace(/[\r\n\t]/g, '_').replace(/[^A-Za-z0-9._-]/g, '_');

const getS3Client = () => {
  const env = getEnv();

  if (env.STORAGE_DRIVER !== 's3') {
    return null;
  }

  if (s3Client) {
    return s3Client;
  }

  const config = {
    region: env.STORAGE_S3_REGION
  };

  if (env.STORAGE_S3_ACCESS_KEY_ID && env.STORAGE_S3_SECRET_ACCESS_KEY) {
    config.credentials = {
      accessKeyId: env.STORAGE_S3_ACCESS_KEY_ID,
      secretAccessKey: env.STORAGE_S3_SECRET_ACCESS_KEY
    };
  }

  if (env.STORAGE_S3_ENDPOINT) {
    config.endpoint = env.STORAGE_S3_ENDPOINT;
  }

  if (env.STORAGE_S3_FORCE_PATH_STYLE) {
    config.forcePathStyle = true;
  }

  s3Client = new S3Client(config);
  return s3Client;
};

const getBucketName = () => getEnv().STORAGE_S3_BUCKET;

const generateObjectKey = ({ workspaceId, documentId, fileName }) => {
  const sanitizedName = sanitizeFileName(fileName);
  return `${workspaceId}/${documentId}/${sanitizedName}`;
};

const createPresignedUploadUrl = async ({ key, contentType, expiresIn = 900 }) => {
  const env = getEnv();

  if (env.STORAGE_DRIVER === 'memory') {
    const token = crypto.randomUUID ? crypto.randomUUID() : uuidv4();
    return {
      uploadUrl: `memory://${encodeURIComponent(key)}?token=${token}`,
      headers: {
        'Content-Type': contentType
      }
    };
  }

  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    ContentType: contentType
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });
  return {
    uploadUrl,
    headers: {
      'Content-Type': contentType
    }
  };
};

const putObject = async ({ key, body, contentType }) => {
  const env = getEnv();

  if (env.STORAGE_DRIVER === 'memory') {
    memoryStore.set(key, {
      body: Buffer.isBuffer(body) ? body : Buffer.from(body),
      contentType
    });
    return { key };
  }

  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: body,
      ContentType: contentType
    })
  );
  return { key };
};

const ensureObjectExists = async (key) => {
  const env = getEnv();

  if (env.STORAGE_DRIVER === 'memory') {
    if (!memoryStore.has(key)) {
      const error = new Error('Uploaded object not found in storage.');
      error.statusCode = 404;
      throw error;
    }

    return true;
  }

  const client = getS3Client();
  await client.send(
    new HeadObjectCommand({
      Bucket: getBucketName(),
      Key: key
    })
  );
  return true;
};

const getObjectBuffer = async (key) => {
  const env = getEnv();

  if (env.STORAGE_DRIVER === 'memory') {
    const stored = memoryStore.get(key);
    if (!stored) {
      const error = new Error('Requested object not found in storage.');
      error.statusCode = 404;
      throw error;
    }

    return {
      buffer: stored.body,
      contentType: stored.contentType
    };
  }

  const client = getS3Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: getBucketName(),
      Key: key
    })
  );

  const buffer = await streamToBuffer(response.Body);

  return {
    buffer,
    contentType: response.ContentType
  };
};

const clearMemoryStore = () => {
  memoryStore.clear();
};

module.exports = {
  createPresignedUploadUrl,
  ensureObjectExists,
  generateObjectKey,
  getBucketName,
  getObjectBuffer,
  putObject,
  clearMemoryStore
};
