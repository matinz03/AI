#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="${PM_IMAGE_NAME:-pm-mvp:local}"
CONTAINER_NAME="${PM_CONTAINER_NAME:-pm-mvp}"
PORT="${PM_PORT:-8000}"

if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  echo "Container $CONTAINER_NAME already exists. Run scripts/stop.sh first."
  exit 1
fi

docker build --tag "$IMAGE_NAME" "$PROJECT_DIR"

ENV_ARGS=()
if [[ -f "$PROJECT_DIR/.env" ]]; then
  ENV_ARGS+=(--env-file "$PROJECT_DIR/.env")
fi

docker run \
  --rm \
  --detach \
  --name "$CONTAINER_NAME" \
  --publish "$PORT:8000" \
  "${ENV_ARGS[@]}" \
  "$IMAGE_NAME"

echo "Project Management MVP is running at http://localhost:$PORT"
