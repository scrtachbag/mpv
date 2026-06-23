"""Mini-client Supabase (PostgREST) pour les jobs, basé sur `requests`.

Utilise la clé *service_role* : elle contourne la RLS, garde-la secrète et
ne l'expose jamais côté navigateur.
"""
from typing import Any
import requests

import config


def _headers(extra: dict | None = None) -> dict:
    h = {
        "apikey": config.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {config.SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    if extra:
        h.update(extra)
    return h


def _url(table: str) -> str:
    return f"{config.SUPABASE_URL}/rest/v1/{table}"


def select(table: str, params: dict | None = None) -> list[dict]:
    r = requests.get(_url(table), headers=_headers(), params=params or {}, timeout=30)
    r.raise_for_status()
    return r.json()


def upsert(table: str, rows: list[dict], on_conflict: str) -> list[dict]:
    """INSERT ... ON CONFLICT (on_conflict) DO UPDATE."""
    if not rows:
        return []
    params = {"on_conflict": on_conflict}
    headers = _headers({"Prefer": "resolution=merge-duplicates,return=representation"})
    r = requests.post(_url(table), headers=headers, params=params, json=rows, timeout=60)
    r.raise_for_status()
    return r.json()


def update(table: str, match: dict, patch: dict) -> list[dict]:
    headers = _headers({"Prefer": "return=representation"})
    params = {k: f"eq.{v}" for k, v in match.items()}
    r = requests.patch(_url(table), headers=headers, params=params, json=patch, timeout=30)
    r.raise_for_status()
    return r.json()


def delete(table: str, match: dict) -> None:
    params = {k: f"eq.{v}" for k, v in match.items()}
    r = requests.delete(_url(table), headers=_headers(), params=params, timeout=30)
    r.raise_for_status()


def delete_all(table: str) -> None:
    """Vide entièrement une table (PostgREST exige un filtre : id>=0 matche tout)."""
    r = requests.delete(_url(table), headers=_headers(), params={"id": "gte.0"}, timeout=60)
    r.raise_for_status()


def upsert_stage(stage: dict[str, Any]) -> int:
    """Insère/maj une étape (clé season+stage_no) et renvoie son id."""
    rows = upsert("stages", [stage], on_conflict="season,stage_no")
    if rows:
        return rows[0]["id"]
    found = select("stages", {
        "season": f"eq.{stage['season']}",
        "stage_no": f"eq.{stage['stage_no']}",
        "select": "id",
    })
    return found[0]["id"]
