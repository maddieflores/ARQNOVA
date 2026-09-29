#!/usr/bin/env bash
set -Eeuo pipefail

# Run once through Session Manager after prisma migrate deploy.
# The password is read silently and exists only in this process environment.

ENV_FILE=/etc/arqnova/backend.env

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this script as root through Session Manager." >&2
  exit 1
fi
if [[ ! -r "$ENV_FILE" || ! -L /opt/arqnova/current ]]; then
  echo "Deploy the validated backend release before running the bootstrap." >&2
  exit 1
fi

read -r -p "Administrator name: " ADMIN_NAME
read -r -p "Administrator email: " ADMIN_EMAIL
read -r -s -p "Administrator password: " ADMIN_PASSWORD
printf '\n'
if [[ -z "$ADMIN_NAME" || -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" ]]; then
  echo "Name, email and password are required." >&2
  unset ADMIN_NAME ADMIN_EMAIL ADMIN_PASSWORD
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
export NODE_ENV=production
export ADMIN_BOOTSTRAP_ENABLED=true
export ADMIN_NAME ADMIN_EMAIL ADMIN_PASSWORD
trap 'unset ADMIN_NAME ADMIN_EMAIL ADMIN_PASSWORD ADMIN_BOOTSTRAP_ENABLED' EXIT

sudo -u arqnova --preserve-env=NODE_ENV,PORT,CORS_ORIGIN,DATABASE_URL,JWT_SECRET,JWT_EXPIRES_IN,AI_PROVIDER,AI_TIMEOUT_MS,GEMINI_API_KEY,GEMINI_MODEL,GEMINI_API_BASE_URL,MAVEN_COMMAND,MAVEN_REPOSITORY,ADMIN_BOOTSTRAP_ENABLED,ADMIN_NAME,ADMIN_EMAIL,ADMIN_PASSWORD \
  npm run prisma:bootstrap-admin --prefix /opt/arqnova/current/backend

echo "Administrator and existing roles verified. Disable the bootstrap guard by ending this session."
