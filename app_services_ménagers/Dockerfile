FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app
COPY docker/api-entrypoint.sh /app/docker/api-entrypoint.sh

RUN mkdir -p /app/logs \
	&& adduser --disabled-password --gecos "" appuser \
	&& chmod +x /app/docker/api-entrypoint.sh \
	&& chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"

CMD ["/app/docker/api-entrypoint.sh"]
