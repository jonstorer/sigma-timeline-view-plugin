#!/usr/bin/env bash

#aws s3api create-bucket \
  #--bucket sigma-timeline-plugin-staging \
  #--region us-east-1

## Block all public access — CloudFront will reach it via OAC, not the public internet.
#aws s3api put-public-access-block \
  #--bucket sigma-timeline-plugin-staging \
  #--public-access-block-configuration \
  #"BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

#aws s3api create-bucket \
  #--bucket sigma-timeline-plugin-production \
  #--region us-east-1

## Block all public access — CloudFront will reach it via OAC, not the public internet.
#aws s3api put-public-access-block \
  #--bucket sigma-timeline-plugin-production \
  #--public-access-block-configuration \
  #"BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

#aws iam create-open-id-connect-provider \
  #--url https://token.actions.githubusercontent.com \
  #--client-id-list sts.amazonaws.com \
  #--thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

#aws iam create-role \
  #--role-name sigma-timeline-plugin-deploy \
  #--assume-role-policy-document file://scripts/trust-policy.json

#aws iam put-role-policy \
  #--role-name sigma-timeline-plugin-deploy \
  #--policy-name deploy \
  #--policy-document file://scripts/permission-policy.json
