# 🚴 MPV — Mon Petit Vélo

Petite appli web pour **parier entre amis (sans argent) sur le Tour de France**.
Chaque matin, l'appli publie une côte pour chaque coureur ; chaque parieur choisit
le coureur qu'il voit gagner l'étape, avant **12h00 (heure de Paris)**. Le soir,
les résultats sont récupérés et le classement se met à jour automatiquement.

## Règles du jeu

| Règle | Détail |
|-------|--------|
| Points | `côte du coureur / place finale` (place de 1 à 10) |
| Bonus victoire | **×2** si le coureur gagne l'étape (1ᵉ) |
| Hors top 10 | **0 point** |
| Deadline | pari à valider **avant 12h00 (Europe/Paris)** |
| Bonus parieur | **2 bonus** pour tout le Tour, ×2 sur les points (cumulable avec le ×2 victoire) |

> Exemple : côte 8.0, le coureur finit 2ᵉ → `8 / 2 = 4 pts`. S'il gagne → `8 / 1 × 2 = 16 pts`.
> Avec un bonus en plus → `× 2` encore.

## Architecture

```
┌──────────────┐    auth + données     ┌────────────────────────┐
│  Front React │◄─────────────────────►│  Supabase               │
│  (GitHub     │   (clé anon, RLS)     │  - Auth e-mail (lien)   │
│   Pages)     │                       │  - Postgres + RLS       │
└──────────────┘                       │  - vue classement       │
        ▲                              └─────────▲──────────────┘
        │ build & deploy                          │ écriture (clé service_role)
┌───────┴───────────────────────────────────────┴────────────────┐
│  GitHub Actions                                                  │
│  - deploy.yml   : build Vite + GitHub Pages (à chaque push main) │
│  - odds.yml     : 07h30 → calcule les côtes (ProCyclingStats)    │
│  - results.yml  : soir  → récupère les résultats + scoring       │
└──────────────────────────────────────────────────────────────────┘
```

- **Côtes** : calculées « maison » à partir des points ProCyclingStats (PCS).
  Aucune API gratuite ne fournit les vraies côtes Winamax ; voir [`jobs/odds.py`](jobs/odds.py).
- **Résultats** : récupérés depuis PCS via la librairie `procyclingstats`.
- **Classement** : vue Postgres live → toujours à jour, pas de recalcul à lancer.

## Structure du dépôt

```
.github/workflows/   deploy.yml · odds.yml · results.yml
supabase/migrations/ 0001_init.sql      (schéma + RLS + scoring)
jobs/                jobs Python (PCS → Supabase)
web/                 front React + Vite
```

---

## Installation pas à pas

### 1. Supabase (base + auth) — gratuit

1. Crée un projet sur [supabase.com](https://supabase.com).
2. **SQL Editor** → colle le contenu de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → *Run*.
3. **Authentication > Providers > Email** : active *Email*. Pour la simplicité,
   garde le « magic link » (connexion par lien, sans mot de passe).
4. **Authentication > URL Configuration** : ajoute l'URL de ton site GitHub Pages
   (`https://<user>.github.io/mon-petit-velo/`) dans *Site URL* et *Redirect URLs*.
5. Note, dans **Project Settings > API** :
   - `Project URL` → `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - clé `anon public` → `VITE_SUPABASE_ANON_KEY`
   - clé `service_role` (🔒 secrète) → `SUPABASE_SERVICE_KEY`

### 2. GitHub

1. Crée le dépôt et pousse ce dossier :
   ```bash
   git init && git add . && git commit -m "MPV initial"
   git branch -M main
   git remote add origin https://github.com/<user>/mon-petit-velo.git
   git push -u origin main
   ```
2. **Settings > Pages** : *Source* = **GitHub Actions**.
3. **Settings > Secrets and variables > Actions** :
   - *Secrets* : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
     `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.
   - *Variables* (facultatif) : `MPV_SEASON` (ex. `2026`),
     `MPV_RACE_SLUG` (défaut `tour-de-france`),
     `VITE_MPV_ACTIONS_URL` (lien vers `…/actions/workflows/results.yml`).
4. L'onglet **Actions** déploie le site à chaque push sur `main`.

### 3. Planification automatique

Les workflows [`odds.yml`](.github/workflows/odds.yml) et
[`results.yml`](.github/workflows/results.yml) tournent déjà en `cron`
(heures **UTC** — pensées pour juillet, Paris = UTC+2) :

| Workflow | Heure Paris | cron (UTC) |
|----------|-------------|------------|
| Côtes du matin | 07h30 | `30 5 * * *` |
| Résultats du soir | 19h30 et 22h00 | `30 17 * * *`, `0 20 * * *` |

> ⚠️ En dehors de l'été (hors DST), décale d'une heure. Tu peux aussi lancer
> chaque workflow à la main via **Actions > Run workflow**.

### 4. Définir l'admin

Connecte-toi une première fois (lien e-mail + pseudo), puis dans **Supabase >
SQL Editor** :
```sql
update public.profiles set is_admin = true where email = 'toi@exemple.fr';
```
L'onglet **Admin** apparaît alors dans l'appli.

---

## Développement local

```bash
# Front
cd web
cp .env.example .env.local      # renseigne VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm install
npm run dev

# Jobs (test)
cd ../jobs
pip install -r requirements.txt
export SUPABASE_URL=...  SUPABASE_SERVICE_KEY=...  MPV_SEASON=2026
python fetch_odds.py            # ou : python fetch_odds.py --stage 1
python fetch_results.py --stage 1
```

## Réglages utiles

- **Côtes** (écart favoris/outsiders, marge, bornes) : variables `MPV_ODDS_*`
  dans [`jobs/config.py`](jobs/config.py).
- **Source des résultats / classement PCS** : tout est isolé dans
  [`jobs/pcs.py`](jobs/pcs.py) — c'est le seul fichier à toucher si la librairie
  `procyclingstats` change un nom de méthode.

## Limites assumées

- Les côtes ne sont **pas** celles de Winamax (aucune API gratuite ne les expose) :
  ce sont des côtes cohérentes dérivées des points PCS.
- Le scraping PCS dépend d'un site tiers ; en cas de souci, relance le workflow
  ou ajuste `jobs/pcs.py`.
