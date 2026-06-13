# AWS S3 setup for browser uploads (Phase 5)

Server-side reads/writes already work. **Direct browser→S3 uploads need a CORS
policy** on the bucket. Apply the two configs below once.

Bucket: `vendor-discovery-model-bucket` · Region: `us-east-1`

---

## 1. CORS policy (required for uploads + image previews)

AWS Console → S3 → your bucket → **Permissions** → **Cross-origin resource
sharing (CORS)** → Edit → paste:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://YOUR-PRODUCTION-DOMAIN"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Replace `YOUR-PRODUCTION-DOMAIN` when you deploy. Add any other dev origins you
use. Without this, the browser upload PUT and signed-URL image loads will be
blocked by CORS (server-side operations are unaffected).

---

## 2. IAM least-privilege policy (recommended)

The access key in `.env.local` should be limited to just this bucket. Attach
this policy to the IAM user:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "VisionDatasetManagerBucketAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::vendor-discovery-model-bucket",
        "arn:aws:s3:::vendor-discovery-model-bucket/*"
      ]
    }
  ]
}
```

---

## Verifying

After applying CORS, open the app → a project → Train Data → **Upload Files**,
drop an image, and it should upload with a progress bar and appear in the grid.
If you see a CORS error in the browser console, re-check the AllowedOrigins.
