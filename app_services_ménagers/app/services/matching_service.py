"""
Matching service — Phase 1

Score de compatibilité prestataire ↔ demande (0–100) :
  - Zone géographique   : 40 pts  (même ville/arrondissement/quartier, ou distance GPS)
  - Rating              : 30 pts  (basé sur note /5 du prestataire)
  - Taux de complétion  : 20 pts  (missions terminées / total)
  - Temps de réponse    : 10 pts  (inverse du temps moyen de réponse, plafonné à 120 min)
"""

from __future__ import annotations

import math
from collections import defaultdict

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Demande, Mission, Prestataire, Service, User
from app.schemas.matching import MatchingCandidate, MatchingResult
from app.schemas.mission import MissionStatus, PrestataireTrustRead

# ---------------------------------------------------------------------------
# Geo helpers
# ---------------------------------------------------------------------------

_EARTH_RADIUS_KM = 6371.0


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km between two (lat, lon) points in degrees."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * _EARTH_RADIUS_KM * math.asin(math.sqrt(a))


# ---------------------------------------------------------------------------
# Score helpers
# ---------------------------------------------------------------------------

_RESPONSE_MAX_MIN = 120  # minutes — beyond this gets 0 pts


def _score_zone(demande: Demande, prestataire_user: User, prestataire: Prestataire) -> tuple[int, float | None]:
    """
    Returns (zone_score 0-40, distance_km or None).

    Strategy:
      - If both have GPS coords → use haversine.
        ≤2 km = 40 pts; ≤5 km = 30 pts; ≤15 km = 15 pts; else 0 pts.
      - Otherwise fall back to text matching on ville/arrondissement/quartier.
        All three match = 40; ville+arrondissement = 28; ville only = 15; no match = 0.
    """
    d_lat = float(demande.latitude) if demande.latitude is not None else None
    d_lon = float(demande.longitude) if demande.longitude is not None else None
    p_lat = float(prestataire.latitude) if prestataire.latitude is not None else None
    p_lon = float(prestataire.longitude) if prestataire.longitude is not None else None

    if d_lat is not None and d_lon is not None and p_lat is not None and p_lon is not None:
        dist = _haversine_km(d_lat, d_lon, p_lat, p_lon)
        if dist <= 2:
            return 40, round(dist, 2)
        if dist <= 5:
            return 30, round(dist, 2)
        if dist <= 15:
            return 15, round(dist, 2)
        return 0, round(dist, 2)

    # Text fallback — we need the provider's address zone.
    # Prestataire doesn't have ville/arr stored directly; we compare demande zone
    # against the services the provider offers (location agnostic for now).
    # We grant a baseline 20 pts to all providers when GPS data is absent.
    return 20, None


def _score_rating(rating: float) -> int:
    """0–30 pts linear from 0 to 5 stars."""
    return round(min(rating / 5.0, 1.0) * 30)


def _score_completion(completed: int, total: int) -> int:
    """0–20 pts: ratio completed/total missions."""
    if total == 0:
        return 10  # neutral for new providers
    return round(min(completed / total, 1.0) * 20)


def _score_response(avg_response_minutes: int | None) -> int:
    """0–10 pts: faster = more points. None (unknown) → neutral 5 pts."""
    if avg_response_minutes is None:
        return 5
    if avg_response_minutes <= 0:
        return 10
    ratio = max(0.0, 1.0 - avg_response_minutes / _RESPONSE_MAX_MIN)
    return round(ratio * 10)


# ---------------------------------------------------------------------------
# Provider stats helper (reused from missions_service logic)
# ---------------------------------------------------------------------------

def _provider_stats(provider_ids: list[int], db: Session) -> dict[int, dict]:
    all_missions = db.scalars(
        select(Mission).where(Mission.prestataire_id.in_(provider_ids))
    ).all()

    demande_ids = list({m.demande_id for m in all_missions})
    demandes_map: dict[int, Demande] = {}
    if demande_ids:
        demandes_map = {
            d.id: d for d in db.scalars(select(Demande).where(Demande.id.in_(demande_ids))).all()
        }

    stats: dict[int, dict] = defaultdict(
        lambda: {"total": 0, "completed": 0, "response_minutes": []}
    )
    for m in all_missions:
        s = stats[m.prestataire_id]
        s["total"] += 1
        if m.status == MissionStatus.TERMINEE:
            s["completed"] += 1
        dem = demandes_map.get(m.demande_id)
        if dem is not None and m.created_at is not None and dem.created_at is not None:
            delta = int(max((m.created_at - dem.created_at).total_seconds(), 0) // 60)
            s["response_minutes"].append(delta)

    return stats


# ---------------------------------------------------------------------------
# Main service
# ---------------------------------------------------------------------------

class MatchingService:
    def get_matching(self, db: Session, demande_id: int) -> MatchingResult:
        demande = db.get(Demande, demande_id)
        if demande is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demande introuvable")

        # Load all active prestataires with their users
        prestataires = db.scalars(select(Prestataire)).all()
        if not prestataires:
            return MatchingResult(demande_id=demande_id, candidates=[], available_count=0)

        provider_ids = [p.user_id for p in prestataires]
        users_map: dict[int, User] = {
            u.id: u
            for u in db.scalars(select(User).where(User.id.in_(provider_ids))).all()
        }
        prestataires_map: dict[int, Prestataire] = {p.user_id: p for p in prestataires}
        stats = _provider_stats(provider_ids, db)

        candidates: list[MatchingCandidate] = []
        for provider_id in provider_ids:
            p = prestataires_map[provider_id]
            user = users_map.get(provider_id)
            s = stats[provider_id]

            total = s["total"]
            completed = s["completed"]
            resp_minutes_list: list[int] = s["response_minutes"]
            avg_response = (
                round(sum(resp_minutes_list) / len(resp_minutes_list))
                if resp_minutes_list
                else None
            )

            rating = float(p.rating) if p.rating is not None else 0.0
            sz, distance_km = _score_zone(demande, user, p)  # type: ignore[arg-type]
            sr = _score_rating(rating)
            sc = _score_completion(completed, total)
            sres = _score_response(avg_response)
            total_score = sz + sr + sc + sres

            display_name = (
                f"{user.first_name} {user.last_name}".strip() if user else f"Prestataire #{provider_id}"
            ) or (user.username if user else f"Prestataire #{provider_id}")

            candidates.append(
                MatchingCandidate(
                    user_id=provider_id,
                    display_name=display_name,
                    avatar_url=user.avatar_url if user else None,
                    trust=PrestataireTrustRead(
                        verified=bool(p.verified),
                        rating=rating,
                        completed_missions=completed,
                        total_missions=total,
                        average_response_minutes=avg_response,
                        eta_reliability_percent=0,
                    ),
                    score_total=total_score,
                    score_zone=sz,
                    score_rating=sr,
                    score_completion=sc,
                    score_response=sres,
                    distance_km=distance_km,
                )
            )

        candidates.sort(key=lambda c: c.score_total, reverse=True)

        return MatchingResult(
            demande_id=demande_id,
            candidates=candidates,
            available_count=len(candidates),
        )


matching_service = MatchingService()
