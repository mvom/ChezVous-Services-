#!/bin/sh
set -eu

if [ "${AUTO_MIGRATE:-true}" = "true" ]; then
  set +e
  python - <<'PY'
from app.db.bootstrap import has_alembic_version, needs_alembic_baseline_stamp

if needs_alembic_baseline_stamp() and not has_alembic_version():
    raise SystemExit(42)
PY
  stamp_exit_code=$?
  set -e

  if [ "$stamp_exit_code" -eq 42 ]; then
    alembic stamp head
  elif [ "$stamp_exit_code" -ne 0 ]; then
    exit "$stamp_exit_code"
  fi

  alembic upgrade head
fi

exec gunicorn app.main:app \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind "${API_HOST:-0.0.0.0}:${API_PORT:-8000}" \
  --workers "${API_WORKERS:-2}" \
  --log-level "${LOG_LEVEL:-info}" \
  --access-logfile - \
  --error-logfile - \
  --logger-class app.core.gunicorn_logging.GunicornJsonLogger
