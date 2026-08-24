import { S3Client } from "@aws-sdk/client-s3";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export function getS3Client(): S3Client {
  const endpoint = process.env.AWS_ENDPOINT_URL_S3 || process.env.AWS_ENDPOINT_URL;
  if (!endpoint) throw new Error("AWS_ENDPOINT_URL_S3 is not set");
  return new S3Client({
    region: need("AWS_REGION"),
    endpoint,
    credentials: {
      accessKeyId: need("AWS_ACCESS_KEY_ID"),
      secretAccessKey: need("AWS_SECRET_ACCESS_KEY"),
    },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
}

export function getBucket(): string {
  return need("S3_BUCKET");
}

export function getPublicBaseUrl(): string {
  // e.g. https://br-xxx.storage.c-4.us-east-2.aws.neon.tech/ratedeezlums
  const base = process.env.S3_PUBLIC_BASE_URL || `${process.env.AWS_ENDPOINT_URL_S3}/${getBucket()}`;
  return base.replace(/\/$/, "");
}

export function s3KeyForProfessor(lumsEmployeeId: string, ext = "jpg"): string {
  return `faculty/${lumsEmployeeId}.${ext}`;
}

export function publicS3UrlForKey(key: string): string {
  return `${getPublicBaseUrl()}/${key}`;
}
