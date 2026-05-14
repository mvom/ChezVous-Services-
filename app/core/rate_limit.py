from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address


def rate_limit_key(request) -> str:
	test_key = request.headers.get("X-RateLimit-Key")
	if test_key:
		return test_key
	return get_remote_address(request)


limiter = Limiter(key_func=rate_limit_key)


__all__ = [
	"RateLimitExceeded",
	"SlowAPIMiddleware",
	"_rate_limit_exceeded_handler",
	"limiter",
]