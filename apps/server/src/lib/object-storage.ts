import fs from 'fs/promises';
import path from 'path';
import { addMilliseconds } from 'date-fns';
import * as AWS from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import {
  getPublicBaseUrl,
  BASE_PROJECT_DIRECTORY,
  OBJECT_STORAGE_IMPLEMENTATION,
  OBJECT_STORAGE_DEFAULT_EXPIRE_TIME_MILLSECONDS,
  OBJECT_STORAGE_BEATS_S3_BUCKET,
  OBJECT_STORAGE_RECORDINGS_S3_BUCKET,
} from '../config.ts';

type ObjectStorageDataType = 'beats' | 'recordings';

// ----------------------------------------------------------------------------
// LOCAL OBJECT STORAGE
// For use in local development - stores data to a local filesystem directory alongside the project
// ------------------------------------------------------------------------------
const LOCAL_OBJECT_STORAGE_BASE_DIRECTORY = path.join(
  BASE_PROJECT_DIRECTORY,
  '.local-object-storage',
);
const LocalObjectStorage = (dataType: ObjectStorageDataType) => ({
  async get(key: string): Promise<Buffer | null> {
    const filePath = path.join(LOCAL_OBJECT_STORAGE_BASE_DIRECTORY, dataType, key);
    try {
      const result = await fs.readFile(filePath);
      return result;
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  async put(key: string, data: string) {
    const filePath = path.join(LOCAL_OBJECT_STORAGE_BASE_DIRECTORY, dataType, key);
    const directoryPath = path.dirname(filePath);

    await fs.mkdir(directoryPath, { recursive: true });
    await fs.writeFile(filePath, data, { encoding: 'utf8' });
  },

  async putFromFilesystem(key: string, filePath: string) {
    const outputFilePath = path.join(LOCAL_OBJECT_STORAGE_BASE_DIRECTORY, dataType, key);
    const outputDirectoryPath = path.dirname(outputFilePath);

    await fs.mkdir(outputDirectoryPath, { recursive: true });
    await fs.copyFile(filePath, outputFilePath);
  },

  async remove(key: string) {
    const filePath = path.join(LOCAL_OBJECT_STORAGE_BASE_DIRECTORY, dataType, key);
    try {
      await fs.unlink(filePath);
      return true;
    } catch (err) {
      return false;
    }
  },

  async getSignedUrl(
    key: string,
    expiresInMilliseconds: number | null = OBJECT_STORAGE_DEFAULT_EXPIRE_TIME_MILLSECONDS,
  ) {
    const expiresAt = expiresInMilliseconds
      ? addMilliseconds(new Date(), expiresInMilliseconds)
      : null;
    return `${getPublicBaseUrl()}/v1/local-object-signed-links/${dataType}/${key}${
      expiresAt ? `?expiresAt=${expiresAt.toISOString()}` : ''
    }`;
  },
});

// ----------------------------------------------------------------------------
// S3 OBJECT STORAGE
// For use in production - read object store data from s3
// ------------------------------------------------------------------------------
const S3ObjectStorage = (dataType: ObjectStorageDataType) => {
  const s3 = new AWS.S3({ region: 'us-east-1' });
  const bucket =
    dataType === 'beats' ? OBJECT_STORAGE_BEATS_S3_BUCKET : OBJECT_STORAGE_RECORDINGS_S3_BUCKET;
  return {
    async get(key: string): Promise<Buffer | null> {
      try {
        const response = await s3.getObject({ Bucket: bucket, Key: key });
        if (response.Body) {
          return Buffer.from(await response.Body.transformToByteArray());
        }
      } catch (err) {
        console.error(err);
      }
      return null;
    },

    async put(key: string, data: string) {
      await s3.putObject({ Bucket: bucket, Key: key, Body: data });
    },

    async putFromFilesystem(key: string, filePath: string) {
      const data = await fs.readFile(filePath);
      await s3.putObject({ Bucket: bucket, Key: key, Body: data });
    },

    async remove(key: string) {
      try {
        await s3.deleteObject({ Bucket: bucket, Key: key });
        return true;
      } catch (err) {
        return false;
      }
    },

    async getSignedUrl(
      key: string,
      expiresInMilliseconds: number | null = OBJECT_STORAGE_DEFAULT_EXPIRE_TIME_MILLSECONDS,
    ) {
      const expiresAt = expiresInMilliseconds
        ? addMilliseconds(new Date(), expiresInMilliseconds)
        : undefined;

      try {
        const url = await getSignedUrl(
          s3,
          new AWS.GetObjectCommand({
            Bucket: bucket,
            Key: key,
            ResponseExpires: expiresAt,
          }),
        );
        return url;
      } catch (err) {
        console.error(err);
        return null;
      }
    },
  };
};

const ConfiguredObjectStorage = {
  local: LocalObjectStorage,
  s3: S3ObjectStorage,
}[OBJECT_STORAGE_IMPLEMENTATION];

const ObjectStorage = ConfiguredObjectStorage || LocalObjectStorage;

export const BeatsObjectStorage = ObjectStorage('beats');
export const RecordingsObjectStorage = ObjectStorage('recordings');
