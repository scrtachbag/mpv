"""Modèles de données légers, SANS dépendance à procyclingstats.

Permet de tester le calcul des côtes (odds.py) sans réseau ni librairie PCS.
"""
from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class StageInfo:
    stage_no: int
    date: str            # "YYYY-MM-DD"
    name: str | None
    profile_type: str | None
    url: str


@dataclass
class RiderEntry:
    name: str
    pcs_id: str | None


@dataclass
class RiderForm:
    """Instantané de force d'un coureur pour le calcul des côtes."""
    name: str
    pcs_id: str | None
    form: float = 0.0                       # points de forme récente
    specialties: dict = field(default_factory=dict)  # {'sprint','climber','gc','one_day','time_trial'}

    def to_json(self) -> dict:
        return {"name": self.name, "pcs_id": self.pcs_id,
                "form": self.form, "specialties": self.specialties}

    @staticmethod
    def from_json(d: dict) -> "RiderForm":
        return RiderForm(name=d["name"], pcs_id=d.get("pcs_id"),
                         form=float(d.get("form", 0.0)),
                         specialties={k: float(v) for k, v in (d.get("specialties") or {}).items()})
