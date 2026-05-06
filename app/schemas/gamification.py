from datetime import datetime

from app.schemas.common import AppBaseModel


class LoyaltyRead(AppBaseModel):
    loyalty_points: int
    completed_missions_count: int
    next_milestone: int
    progress_percent: int


class BadgeRead(AppBaseModel):
    id: int
    user_id: int
    slug: str
    awarded_at: datetime
