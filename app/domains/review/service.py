from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.db.models import Review
from .repository import ReviewsRepository
from .schemas import ReviewCreate, ReviewRead


class ReviewsService:
    def __init__(self, repo: ReviewsRepository) -> None:
        self.repo = repo

    def create_review(self, payload: ReviewCreate) -> ReviewRead:
        if self.repo.get_mission(payload.mission_id) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mission invalide")

        review = Review(**payload.model_dump())
        self.repo.add_review(review)
        try:
            self.repo.commit()
        except IntegrityError as exc:
            self.repo.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Une evaluation existe deja pour cette mission",
            ) from exc
        self.repo.refresh(review)
        return ReviewRead.model_validate(review)

    def list_reviews(self) -> list[ReviewRead]:
        return [ReviewRead.model_validate(item) for item in self.repo.list_reviews()]
