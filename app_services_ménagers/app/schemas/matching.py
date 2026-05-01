from app.schemas.common import AppBaseModel
from app.schemas.mission import PrestataireTrustRead


class MatchingCandidate(AppBaseModel):
    user_id: int
    display_name: str
    avatar_url: str | None = None
    trust: PrestataireTrustRead
    # Score components (0–100 each)
    score_total: int
    score_zone: int
    score_rating: int
    score_completion: int
    score_response: int
    # Optional geo info when coordinates are available
    distance_km: float | None = None


class MatchingResult(AppBaseModel):
    demande_id: int
    candidates: list[MatchingCandidate]
    available_count: int
