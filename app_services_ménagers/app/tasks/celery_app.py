from celery import Celery

from app.core.config import settings
from app.core.log_config import setup_logging


setup_logging(settings)

celery_app = Celery(
    "services_menagers",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "detect-delay-risk-every-10-min": {
            "task": "app.tasks.detect_delay_risk",
            "schedule": 600.0,
        }
    },
)

celery_app.autodiscover_tasks(["app.tasks"])
