"""Tests unitaires pour les helpers purs du matching_service."""
import math
import pytest

from app.services.matching_service import (
    _haversine_km,
    _score_rating,
)


@pytest.mark.unit
class TestHaversine:
    def test_same_point_is_zero(self):
        assert _haversine_km(0.0, 0.0, 0.0, 0.0) == pytest.approx(0.0)

    def test_known_distance_douala_yaounde(self):
        # Douala approx: 4.05, 9.70 — Yaounde approx: 3.87, 11.52
        dist = _haversine_km(4.05, 9.70, 3.87, 11.52)
        assert 195 < dist < 215  # known ~200 km by haversine

    def test_equatorial_degree_is_approx_111km(self):
        dist = _haversine_km(0.0, 0.0, 0.0, 1.0)
        assert dist == pytest.approx(111.3, abs=0.5)

    def test_symmetry(self):
        d1 = _haversine_km(4.0, 9.7, 3.9, 11.5)
        d2 = _haversine_km(3.9, 11.5, 4.0, 9.7)
        assert d1 == pytest.approx(d2)


@pytest.mark.unit
class TestScoreRating:
    def test_max_rating_gives_30_pts(self):
        assert _score_rating(5.0) == 30

    def test_zero_rating_gives_0_pts(self):
        assert _score_rating(0.0) == 0

    def test_half_rating_gives_15_pts(self):
        assert _score_rating(2.5) == 15

    def test_score_is_integer(self):
        result = _score_rating(3.3)
        assert isinstance(result, int)

    def test_score_clamped_in_range(self):
        assert 0 <= _score_rating(4.0) <= 30
