#!/usr/bin/env bash
set -Eeuo pipefail

# Run on EC2 through Session Manager after Caddy is provisioned.
# Usage: sudo ./deploy-frontend.sh deploy
#        sudo ./deploy-frontend.sh rollback

ACTION="${1:-deploy}"
CONFIG_FILE=/etc/arqnova/deployment.conf
RELEASES_DIR=/opt/arqnova/frontend-releases
CURRENT_LINK=/opt/arqnova/frontend-current
PREVIOUS_LINK=/opt/arqnova/frontend-previous

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this script as root through Session Manager." >&2
  exit 1
fi
if [[ ! -r "$CONFIG_FILE" ]]; then
  echo "Missing $CONFIG_FILE; create the backend EC2 stack first." >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$CONFIG_FILE"
: "${GIT_REPOSITORY:?}"
: "${GIT_BRANCH:?}"
: "${SOURCE_COMMIT:?}"
: "${PUBLIC_ORIGIN:?}"

if [[ "$GIT_BRANCH" != production || "$SOURCE_COMMIT" != ee58e0191bd5a476e91610af37632eab96f4a5cf ]]; then
  echo "Refusing to deploy anything except the validated production commit." >&2
  exit 1
fi

rollback() {
  if [[ ! -L "$PREVIOUS_LINK" ]]; then
    echo "No previous frontend release is available." >&2
    exit 1
  fi
  ln -sfn "$(readlink -f "$PREVIOUS_LINK")" "$CURRENT_LINK"
  caddy validate --config /etc/caddy/Caddyfile
  systemctl reload caddy
  echo "Frontend rolled back to $(basename "$(readlink -f "$CURRENT_LINK")")."
}

if [[ "$ACTION" == rollback ]]; then
  rollback
  exit 0
fi
if [[ "$ACTION" != deploy ]]; then
  echo "Unknown action: $ACTION" >&2
  exit 1
fi

WORK_DIR="$(mktemp -d /tmp/arqnova-frontend-XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT
git clone --quiet --branch production --single-branch "$GIT_REPOSITORY" "$WORK_DIR/source"
cd "$WORK_DIR/source"
git cat-file -e "$SOURCE_COMMIT^{commit}"
if ! git merge-base --is-ancestor "$SOURCE_COMMIT" origin/production; then
  echo "Validated commit is not contained in origin/production." >&2
  exit 1
fi
git checkout --quiet --detach "$SOURCE_COMMIT"

sudo -u arqnova npm ci --prefix frontend
sudo -u arqnova env VITE_API_URL="$PUBLIC_ORIGIN/api" VITE_SOCKET_URL="$PUBLIC_ORIGIN" npm run build --prefix frontend
RELEASE_DIR="$RELEASES_DIR/$SOURCE_COMMIT"
rm -rf "$RELEASE_DIR"
install -d -o arqnova -g arqnova "$RELEASE_DIR"
cp -a frontend/dist/. "$RELEASE_DIR/"
chown -R arqnova:arqnova "$RELEASE_DIR"
find "$RELEASE_DIR" -type d -exec chmod 755 {} +
find "$RELEASE_DIR" -type f -exec chmod 644 {} +

if [[ -L "$CURRENT_LINK" ]]; then
  ln -sfn "$(readlink -f "$CURRENT_LINK")" "$PREVIOUS_LINK"
fi
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
caddy validate --config /etc/caddy/Caddyfile
systemctl enable --now caddy
curl --fail --silent --resolve "${PUBLIC_ORIGIN#https://}:443:127.0.0.1" "$PUBLIC_ORIGIN/" >/dev/null || true
echo "Frontend deployed from production commit $SOURCE_COMMIT"
