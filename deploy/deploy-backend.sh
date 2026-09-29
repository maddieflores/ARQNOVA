#!/usr/bin/env bash
set -Eeuo pipefail

# Run on EC2 through Session Manager.
# Usage: sudo ./deploy-backend.sh deploy
#        sudo ./deploy-backend.sh rollback

ACTION="${1:-deploy}"
CONFIG_FILE=/etc/arqnova/deployment.conf
ENV_FILE=/etc/arqnova/backend.env
RELEASES_DIR=/opt/arqnova/releases
CURRENT_LINK=/opt/arqnova/current
PREVIOUS_LINK=/opt/arqnova/previous
SERVICE_NAME=arqnova-backend

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this script as root through Session Manager." >&2
  exit 1
fi
if [[ ! -r "$CONFIG_FILE" ]]; then
  echo "Missing $CONFIG_FILE; create the backend stack first." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$CONFIG_FILE"
: "${AWS_REGION:?}"
: "${GIT_REPOSITORY:?}"
: "${GIT_BRANCH:?}"
: "${SOURCE_COMMIT:?}"
: "${DATABASE_SECRET_ARN:?}"
: "${APPLICATION_SECRET_ARN:?}"
: "${DATABASE_NAME:?}"
: "${CORS_ORIGIN:?}"

if [[ "$GIT_BRANCH" != production ]]; then
  echo "Refusing to deploy a branch other than production." >&2
  exit 1
fi

rollback() {
  if [[ ! -L "$PREVIOUS_LINK" ]]; then
    echo "No previous backend release is available." >&2
    exit 1
  fi
  local previous_target
  previous_target="$(readlink -f "$PREVIOUS_LINK")"
  ln -sfn "$previous_target" "$CURRENT_LINK"
  systemctl restart "$SERVICE_NAME"
  sleep 5
  curl --fail --silent http://127.0.0.1:3000/api/health >/dev/null
  echo "Backend rolled back to $(basename "$previous_target"). Database migrations are not rolled back."
}

if [[ "$ACTION" == rollback ]]; then
  rollback
  exit 0
fi
if [[ "$ACTION" != deploy ]]; then
  echo "Unknown action: $ACTION" >&2
  exit 1
fi

DB_JSON="$(aws secretsmanager get-secret-value --region "$AWS_REGION" --secret-id "$DATABASE_SECRET_ARN" --query SecretString --output text)"
APP_JSON="$(aws secretsmanager get-secret-value --region "$AWS_REGION" --secret-id "$APPLICATION_SECRET_ARN" --query SecretString --output text)"
DB_USER="$(jq -er .username <<<"$DB_JSON")"
DB_PASSWORD="$(jq -er .password <<<"$DB_JSON")"
DB_HOST="$(jq -er .host <<<"$DB_JSON")"
DB_PORT="$(jq -er '.port // 5432' <<<"$DB_JSON")"
JWT_SECRET="$(jq -er .JWT_SECRET <<<"$APP_JSON")"
GEMINI_API_KEY="$(jq -er .GEMINI_API_KEY <<<"$APP_JSON")"
AI_PROVIDER="$(jq -er '.AI_PROVIDER // "gemini"' <<<"$APP_JSON")"
AI_TIMEOUT_MS="$(jq -er '.AI_TIMEOUT_MS // "25000"' <<<"$APP_JSON")"
GEMINI_MODEL="$(jq -er .GEMINI_MODEL <<<"$APP_JSON")"
GEMINI_API_BASE_URL="$(jq -er '.GEMINI_API_BASE_URL // "https://generativelanguage.googleapis.com/v1beta"' <<<"$APP_JSON")"
if [[ "$GEMINI_API_KEY" == REPLACE_BEFORE_DEPLOY ]]; then
  echo "Populate GEMINI_API_KEY in the application secret before deployment." >&2
  exit 1
fi
if [[ "$GEMINI_MODEL" != gemini-3.5-flash-lite || "$AI_TIMEOUT_MS" != 25000 ]]; then
  echo "Gemini model or timeout differs from validated production." >&2
  exit 1
fi

DB_USER_URI="$(jq -rn --arg value "$DB_USER" '$value|@uri')"
DB_PASSWORD_URI="$(jq -rn --arg value "$DB_PASSWORD" '$value|@uri')"
DATABASE_URL="postgresql://${DB_USER_URI}:${DB_PASSWORD_URI}@${DB_HOST}:${DB_PORT}/${DATABASE_NAME}?schema=public&sslmode=require"

umask 077
TEMP_ENV="$(mktemp)"
SOURCE_DIR="$(mktemp -d /tmp/arqnova-source-XXXXXX)"
cleanup() {
  rm -f "$TEMP_ENV"
  [[ -z "${SOURCE_DIR:-}" ]] || rm -rf "$SOURCE_DIR"
  unset DB_JSON APP_JSON DB_PASSWORD JWT_SECRET GEMINI_API_KEY DATABASE_URL
}
trap cleanup EXIT
cat >"$TEMP_ENV" <<EOF
NODE_ENV=production
PORT=3000
CORS_ORIGIN=$CORS_ORIGIN
DATABASE_URL=$DATABASE_URL
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=3600
AI_PROVIDER=$AI_PROVIDER
AI_TIMEOUT_MS=$AI_TIMEOUT_MS
GEMINI_API_KEY=$GEMINI_API_KEY
GEMINI_MODEL=$GEMINI_MODEL
GEMINI_API_BASE_URL=$GEMINI_API_BASE_URL
MAVEN_COMMAND=/usr/bin/mvn
MAVEN_REPOSITORY=/var/cache/arqnova-maven
EOF
install -o root -g root -m 600 "$TEMP_ENV" "$ENV_FILE"

git clone --quiet --branch production --single-branch "$GIT_REPOSITORY" "$SOURCE_DIR"
cd "$SOURCE_DIR"
git cat-file -e "$SOURCE_COMMIT^{commit}"
if ! git merge-base --is-ancestor "$SOURCE_COMMIT" origin/production; then
  echo "Validated commit is not contained in origin/production." >&2
  exit 1
fi
git checkout --quiet --detach "$SOURCE_COMMIT"
RESOLVED_COMMIT="$(git rev-parse HEAD)"
RELEASE_DIR="$RELEASES_DIR/$RESOLVED_COMMIT"
if [[ ! -d "$RELEASE_DIR" ]]; then
  cd /
  mv "$SOURCE_DIR" "$RELEASE_DIR"
  SOURCE_DIR=''
fi
chown -R arqnova:arqnova "$RELEASE_DIR"

sudo -u arqnova npm ci --prefix "$RELEASE_DIR/backend"
NODE_ENV=production
PORT=3000
JWT_EXPIRES_IN=3600
MAVEN_COMMAND=/usr/bin/mvn
MAVEN_REPOSITORY=/var/cache/arqnova-maven
export NODE_ENV PORT CORS_ORIGIN DATABASE_URL JWT_SECRET JWT_EXPIRES_IN AI_PROVIDER AI_TIMEOUT_MS GEMINI_API_KEY GEMINI_MODEL GEMINI_API_BASE_URL MAVEN_COMMAND MAVEN_REPOSITORY
[[ -n "${DATABASE_URL:-}" ]] && echo DATABASE_URL_SET || { echo DATABASE_URL_MISSING >&2; exit 1; }
sudo -u arqnova bash -c 'export DATABASE_URL="$1"; exec npm run prisma:generate --prefix "$2"' _ "$DATABASE_URL" "$RELEASE_DIR/backend"
sudo -u arqnova npm run build --prefix "$RELEASE_DIR/backend"
sudo -u arqnova --preserve-env=NODE_ENV,PORT,CORS_ORIGIN,DATABASE_URL,JWT_SECRET,JWT_EXPIRES_IN,AI_PROVIDER,AI_TIMEOUT_MS,GEMINI_API_KEY,GEMINI_MODEL,GEMINI_API_BASE_URL,MAVEN_COMMAND,MAVEN_REPOSITORY \
  npm run prisma:migrate:deploy --prefix "$RELEASE_DIR/backend"

if [[ -L "$CURRENT_LINK" ]]; then
  ln -sfn "$(readlink -f "$CURRENT_LINK")" "$PREVIOUS_LINK"
fi
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"
for _ in {1..30}; do
  if curl --fail --silent http://127.0.0.1:3000/api/health >/dev/null; then
    echo "Backend deployed from production commit $RESOLVED_COMMIT"
    exit 0
  fi
  sleep 2
done

echo "Health check failed; attempting binary rollback." >&2
rollback
exit 1
