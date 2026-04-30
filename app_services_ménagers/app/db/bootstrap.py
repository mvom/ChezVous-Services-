from sqlalchemy import inspect, text

from app.db.session import engine


def needs_alembic_baseline_stamp() -> bool:
    """Return True when schema exists but Alembic revision is not stamped yet."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    # Existing schema was probably created by the SQL bootstrap script.
    known_app_tables = {
        "users",
        "clients",
        "prestataires",
        "services",
        "demandes",
        "missions",
        "reviews",
        "paiements",
    }
    has_application_tables = bool(tables.intersection(known_app_tables))
    if not has_application_tables:
        return False

    return not has_alembic_version()


def has_alembic_version() -> bool:
    inspector = inspect(engine)
    if "alembic_version" not in set(inspector.get_table_names()):
        return False

    with engine.connect() as connection:
        result = connection.execute(text("SELECT COUNT(*) FROM alembic_version"))
        return int(result.scalar_one()) > 0