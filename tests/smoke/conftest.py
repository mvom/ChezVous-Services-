"""
Smoke test conftest: skip all smoke tests when Docker Compose is not available
or the required containers are not running locally.
"""
import subprocess

import pytest


def _docker_compose_reachable() -> bool:
    """Return True only if `docker compose ps` succeeds and shows the expected containers."""
    try:
        result = subprocess.run(
            ["docker", "compose", "ps"],
            capture_output=True,
            text=True,
            timeout=8,
        )
        return result.returncode == 0 and "menage_api" in result.stdout
    except Exception:  # noqa: BLE001
        return False


_SKIP_REASON = (
    "Docker Compose stack not running locally "
    "(menage_api container absent or Docker unreachable). "
    "Start the stack with `docker compose up -d` to run smoke tests."
)


def pytest_collection_modifyitems(items: list) -> None:
    """Auto-skip smoke tests when the Docker Compose stack is unavailable."""
    if _docker_compose_reachable():
        return
    skip_mark = pytest.mark.skip(reason=_SKIP_REASON)
    for item in items:
        if "smoke" in str(item.fspath):
            item.add_marker(skip_mark)
