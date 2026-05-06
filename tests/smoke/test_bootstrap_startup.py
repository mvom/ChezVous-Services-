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
    if "menage_redis" not in combined:
        pytest.skip(
            "menage_redis container not running — Redis and worker are optional locally. "
            "Start with `docker compose --profile async up -d` to run this test."
        )


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


@pytest.mark.smoke
def test_alembic_user_roles_backfill_on_migrated_docker_db():
        assert_required_services_running()

        ready_payload = wait_ready()
        assert ready_payload.get("status") == "ok"
        assert ready_payload.get("database") == "up"

        table_exists = query_db("SELECT to_regclass('public.user_roles') IS NOT NULL;")
        assert table_exists == "t", f"user_roles table is missing: {table_exists}"

        users_count = query_db("SELECT COUNT(*) FROM users;")
        roles_count = query_db("SELECT COUNT(*) FROM user_roles;")
        assert users_count.isdigit(), users_count
        assert roles_count.isdigit(), roles_count
        assert int(roles_count) >= int(users_count)

        missing_backfill = query_db(
                """
                SELECT COUNT(*)
                FROM users AS u
                LEFT JOIN user_roles AS ur
                    ON ur.user_id = u.id
                 AND ur.role = u.role
                WHERE ur.id IS NULL;
                """
        )
        assert missing_backfill.isdigit(), missing_backfill
        assert int(missing_backfill) == 0

        duplicate_links = query_db(
                """
                SELECT COUNT(*)
                FROM (
                    SELECT user_id, role, COUNT(*) AS cnt
                    FROM user_roles
                    GROUP BY user_id, role
                    HAVING COUNT(*) > 1
                ) AS d;
                """
        )
        assert duplicate_links.isdigit(), duplicate_links
        assert int(duplicate_links) == 0

        required_indexes = query_db(
                """
                SELECT COUNT(*)
                FROM pg_indexes
                WHERE schemaname = 'public'
                    AND indexname IN ('ix_user_roles_user_id', 'ix_user_roles_role');
                """
        )
        assert required_indexes.isdigit(), required_indexes
        assert int(required_indexes) == 2
