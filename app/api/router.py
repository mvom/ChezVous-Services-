from fastapi import APIRouter

from app.domains.auth.router import router as auth_router
from app.domains.demandes.router import router as demandes_router
from app.domains.missions.router import router as missions_router
from app.domains.paiement.router import router as paiements_router
from app.domains.prestataires.router import router as prestataires_router
from app.domains.review.router import router as reviews_router
from app.domains.service.router import router as services_router


api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(demandes_router)
api_router.include_router(prestataires_router)
api_router.include_router(services_router)
api_router.include_router(missions_router)
api_router.include_router(paiements_router)
api_router.include_router(reviews_router)
