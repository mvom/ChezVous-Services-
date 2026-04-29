from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Mission, Review
from app.schemas.review import ReviewCreate, ReviewRead


class ReviewsService:
    def create_review(self, db: Session, payload: ReviewCreate) -> ReviewRead:
        if db.get(Mission, payload.mission_id) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mission invalide")

        review = Review(**payload.model_dump())
        db.add(review)
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Une evaluation existe deja pour cette mission",
            ) from exc
        db.refresh(review)
        return ReviewRead.model_validate(review)

    def list_reviews(self, db: Session) -> list[ReviewRead]:
        reviews = db.scalars(select(Review).order_by(Review.id)).all()
        return [ReviewRead.model_validate(item) for item in reviews]


reviews_service = ReviewsService()
