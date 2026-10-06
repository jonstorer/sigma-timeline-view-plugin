#!/usr/bin/env bash
# Publish a built plugin to its own folder in S3 — multiple plugins share one
# bucket, each under s3://<bucket>/<plugin-name>/. `--delete` below is scoped
# to that prefix, so a deploy only ever touches its own plugin's folder.
#
# Usage: deploy.sh <plugin-name>
#   Run from the plugin's own directory, after `npm run build` (so ./dist
#   exists there). Each plugin's `npm run deploy` already does this.
#
# Required env vars:
#   S3_BUCKET                  Name of the S3 bucket (e.g. my-plugin-bucket)
#   AWS_REGION                 AWS region (e.g. us-east-1)
#
# Optional env vars:
#   CLOUDFRONT_DISTRIBUTION_ID If set, invalidates /<plugin-name>/index.html

set -euo pipefail

PLUGIN_NAME="${1:?Usage: deploy.sh <plugin-name>}"
: "${S3_BUCKET:?S3_BUCKET env var must be set}"
: "${AWS_REGION:?AWS_REGION env var must be set}"

if [[ ! -d dist ]]; then
  echo "dist/ not found — run \`npm run build\` first." >&2
  exit 1
fi

DEST="s3://${S3_BUCKET}/${PLUGIN_NAME}"

# Hashed assets: long-cache + immutable
aws s3 sync dist/ "${DEST}/" \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude index.html

# Entry point: never cache so a fresh deploy is picked up immediately
aws s3 cp dist/index.html "${DEST}/index.html" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html; charset=utf-8"

if [[ -n "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]]; then
  aws cloudfront create-invalidation \
    --distribution-id "${CLOUDFRONT_DISTRIBUTION_ID}" \
    --paths "/${PLUGIN_NAME}/index.html"
fi

echo "Deployed to ${DEST}/"
