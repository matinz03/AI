#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${PM_CONTAINER_NAME:-pm-mvp}"

if ! docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  echo "Container $CONTAINER_NAME is not present."
  exit 0
fi

if [[ "$(docker inspect --format '{{.State.Running}}' "$CONTAINER_NAME")" == "true" ]]; then
  docker stop "$CONTAINER_NAME"
  echo "Stopped $CONTAINER_NAME."
else
  echo "Container $CONTAINER_NAME is already stopped."
fi
