#!/usr/bin/env bash
# Publish the built plugin to S3.
#
# Required env vars:
#   S3_BUCKET                  Name of the S3 bucket (e.g. my-plugin-bucket)
#   AWS_REGION                 AWS region (e.g. us-east-1)
#
# Optional env vars:
#   CLOUDFRONT_DISTRIBUTION_ID If set, invalidates /index.html after upload
#
# Run after `npm run build` so dist/ exists. Or use `npm run deploy` which
# does both in one shot.

set -euo pipefail

: "${S3_BUCKET:?S3_BUCKET env var must be set}"
: "${AWS_REGION:?AWS_REGION env var must be set}"

if [[ ! -d dist ]]; then
  echo "dist/ not found — run \`npm run build\` first." >&2
  exit 1
fi

# Hashed assets: long-cache + immutable
aws s3 sync dist/ "s3://${S3_BUCKET}/" \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude index.html

# Entry point: never cache so a fresh deploy is picked up immediately
aws s3 cp dist/index.html "s3://${S3_BUCKET}/index.html" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html; charset=utf-8"

if [[ -n "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]]; then
  aws cloudfront create-invalidation \
    --distribution-id "${CLOUDFRONT_DISTRIBUTION_ID}" \
    --paths "/index.html"
fi

echo "Deployed to s3://${S3_BUCKET}/"
