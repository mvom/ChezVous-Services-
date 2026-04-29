from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.db.models import User
from app.schemas.review import ReviewCreate, ReviewRead
from app.schemas.user import UserRole
from app.services.reviews_service import reviews_service


router = APIRouter(prefix="/reviews", tags=["Reviews"])


@router.post("", response_model=ReviewRead, status_code=status.HTTP_201_CREATED)
def create_review(
    payload: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CLIENT, UserRole.ADMIN)),
) -> ReviewRead:
    if current_user.role == UserRole.CLIENT and payload.client_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="client_id invalide")
    return reviews_service.create_review(db, payload)


@router.get("", response_model=list[ReviewRead])
def list_reviews(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ReviewRead]:
    return reviews_service.list_reviews(db)
