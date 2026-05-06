from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Mission, Review


class ReviewsRepository(Protocol):
    def get_mission(self, mission_id: int) -> Mission | None:
        ...

    def get_review(self, review_id: int) -> Review | None:
        ...

    def add_review(self, review: Review) -> None:
        ...

    def list_reviews(self) -> list[Review]:
        ...

    def commit(self) -> None:
        ...

    def rollback(self) -> None:
        ...

    def refresh(self, review: Review) -> None:
        ...


class SqlAlchemyReviewsRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_mission(self, mission_id: int) -> Mission | None:
        return self.db.get(Mission, mission_id)

    def get_review(self, review_id: int) -> Review | None:
        return self.db.get(Review, review_id)

    def add_review(self, review: Review) -> None:
        self.db.add(review)

    def list_reviews(self) -> list[Review]:
        return self.db.scalars(select(Review).order_by(Review.id)).all()

    def commit(self) -> None:
        self.db.commit()

    def rollback(self) -> None:
        self.db.rollback()

    def refresh(self, review: Review) -> None:
        self.db.refresh(review)
