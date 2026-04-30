import logging

from gunicorn.glogging import Logger

from app.core.log_config import JsonFormatter


class GunicornJsonLogger(Logger):
    def setup(self, cfg):
        super().setup(cfg)

        formatter: logging.Formatter
        if str(cfg.loglevel).upper() == "DEBUG":
            formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(name)s | %(message)s")
        else:
            formatter = JsonFormatter()

        for handler in self.error_log.handlers:
            handler.setFormatter(formatter)

        for handler in self.access_log.handlers:
            handler.setFormatter(formatter)

        uvicorn_error = logging.getLogger("uvicorn.error")
        uvicorn_error.handlers = self.error_log.handlers
        uvicorn_error.propagate = False

        uvicorn_access = logging.getLogger("uvicorn.access")
        uvicorn_access.handlers = self.access_log.handlers
        uvicorn_access.propagate = False
