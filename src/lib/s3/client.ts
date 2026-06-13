/**
 * S3 client + low-level operations. Server-only — never import client-side.
 * Credentials come from env and never reach the browser.
 */

import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const S3_BUCKET = process.env.S3_BUCKET_NAME ?? "";

let _client: S3Client | null = null;
export function s3(): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    region: required("AWS_REGION"),
    credentials: {
      accessKeyId: required("AWS_ACCESS_KEY_ID"),
      secretAccessKey: required("AWS_SECRET_ACCESS_KEY"),
    },
  });
  return _client;
}

// --- Operations ---

export async function putObject(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType?: string
): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const res = await s3().send(
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key })
  );
  return res.Body!.transformToByteArray();
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  // S3 DeleteObjects caps at 1000 keys per request.
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    await s3().send(
      new DeleteObjectsCommand({
        Bucket: S3_BUCKET,
        Delete: { Objects: batch.map((Key) => ({ Key })) },
      })
    );
  }
}

export interface S3ObjectInfo {
  key: string;
  size: number;
  lastModified?: Date;
}

/** List all objects under a prefix (handles pagination). */
export async function listObjects(prefix: string): Promise<S3ObjectInfo[]> {
  const out: S3ObjectInfo[] = [];
  let token: string | undefined;
  do {
    const res = await s3().send(
      new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    for (const o of res.Contents ?? []) {
      if (o.Key) out.push({ key: o.Key, size: o.Size ?? 0, lastModified: o.LastModified });
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return out;
}

export async function headObject(key: string): Promise<{ size: number } | null> {
  try {
    const res = await s3().send(
      new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key })
    );
    return { size: res.ContentLength ?? 0 };
  } catch {
    return null;
  }
}

export async function copyObject(fromKey: string, toKey: string): Promise<void> {
  await s3().send(
    new CopyObjectCommand({
      Bucket: S3_BUCKET,
      CopySource: `${S3_BUCKET}/${encodeURIComponent(fromKey).replace(/%2F/g, "/")}`,
      Key: toKey,
    })
  );
}

// --- Signed URLs ---

export async function signedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 900
): Promise<string> {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn }
  );
}

export async function signedDownloadUrl(
  key: string,
  expiresIn = 900,
  downloadName?: string
): Promise<string> {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ResponseContentDisposition: downloadName
        ? `attachment; filename="${downloadName}"`
        : undefined,
    }),
    { expiresIn }
  );
}
