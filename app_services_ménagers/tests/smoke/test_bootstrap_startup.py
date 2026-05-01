import subprocess
import time

import httpx
import pytest


COMPOSE_CMD = ["docker", "compose", "--profile", "async"]


def run_compose(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    command = [*COMPOSE_CMD, *args]
    result = subprocess.run(
        command,
        text=True,
        capture_output=True,
    )
    if check and result.returncode != 0:
        raise AssertionError(
            "Docker compose command failed:\n"
            f"command: {' '.join(command)}\n"
            f"exit_code: {result.returncode}\n"
            f"stdout:\n{result.stdout}\n"
            f"stderr:\n{result.stderr}"
        )
    return result


def wait_ready(timeout_seconds: int = 120) -> dict:
    deadline = time.time() + timeout_seconds
    last_error = ""

    while time.time() < deadline:
        try:
            response = httpx.get("http://127.0.0.1:8000/ready", timeout=3.0)
            if response.status_code == 200:
                return response.json()
            last_error = f"status={response.status_code}, body={response.text}"
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)
        time.sleep(2)

    raise AssertionError(f"API /ready did not become healthy in time: {last_error}")


def wait_worker_connected(timeout_seconds: int = 120) -> str:
    deadline = time.time() + timeout_seconds
    last_logs = ""

    while time.time() < deadline:
        logs_result = run_compose("logs", "--no-color", "worker", check=False)
        last_logs = f"{logs_result.stdout}\n{logs_result.stderr}"
        if "Connected to redis://" in last_logs and "ready." in last_logs:
            return last_logs
        time.sleep(2)

    raise AssertionError("Worker did not connect to Redis in time.\n" + last_logs[-3000:])


def query_db(sql: str) -> str:
    result = run_compose(
        "exec",
        "-T",
        "db",
        "psql",
        "-U",
        "postgres",
        "-d",
        "services_menagers",
        "-tAc",
        sql,
    )
    return result.stdout.strip()


def assert_required_services_running() -> None:
    result = run_compose("ps", check=False)
    combined = f"{result.stdout}\n{result.stderr}"
    assert "menage_api" in combined, combined
    assert "menage_db" in combined, combined
    assert "menage_redis" in combined, combined
    assert "menage_worker" in combined, combined


@pytest.mark.smoke
def test_bootstrap_migration_ready_and_worker_redis_connection():
    assert_required_services_running()

    ready_payload = wait_ready()
    assert ready_payload.get("status") == "ok"
    assert ready_payload.get("database") == "up"

    revision_count = query_db("SELECT COUNT(*) FROM alembic_version;")
    assert revision_count.isdigit(), revision_count
    assert int(revision_count) >= 1

    expected_revision = run_compose(
        "exec",
        "-T",
        "api",
        "python",
        "-m",
        "alembic",
        "heads",
    ).stdout.strip().split()[0]
    revision = query_db("SELECT version_num FROM alembic_version LIMIT 1;")
    assert revision == expected_revision

    worker_logs = wait_worker_connected()
    assert "Connected to redis://" in worker_logs
