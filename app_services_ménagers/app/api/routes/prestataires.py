from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.db.models import User
from app.schemas.prestataire import PrestataireRead
from app.services.prestataires_service import prestataires_service


router = APIRouter(prefix="/prestataires", tags=["Prestataires"])


@router.get("", response_model=list[PrestataireRead])
def list_prestataires(
    verified_only: bool = Query(default=False),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[PrestataireRead]:
    return prestataires_service.list_prestataires(db, verified_only=verified_only)
