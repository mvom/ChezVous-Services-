from fastapi import APIRouter

from app.api.routes import auth, demandes, missions, paiements, prestataires, reviews, services


api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(demandes.router)
api_router.include_router(prestataires.router)
api_router.include_router(services.router)
api_router.include_router(missions.router)
api_router.include_router(paiements.router)
api_router.include_router(reviews.router)
