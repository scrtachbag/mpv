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
│  (GitHub     │   (clé anon, RLS)     │  - Auth e-mail + mdp    │
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
3. **Authentication > Providers > Email** : active *Email* avec
   **mot de passe** (l'appli utilise e-mail + mot de passe). Décide si tu veux
   *Confirm email* (recommandé en prod) ou non (connexion immédiate à l'inscription).
   Les e-mails sont brandés MPV ([`supabase/templates`](supabase/templates/)) ;
   en local ils s'appliquent via `config.toml`, en cloud colle-les dans
   *Auth > Email Templates* (ou `npx supabase config push` sur le projet lié).
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

Crée ton compte admin dans l'appli (e-mail + mot de passe + pseudo), puis dans
**Supabase > SQL Editor** :
```sql
update public.profiles set is_admin = true where email = 'admin@exemple.fr';
```
Reconnecte-toi (ou rafraîchis) : l'onglet **Admin** apparaît alors dans l'appli.

### 5. (Optionnel) Bouton admin « Récupérer les résultats »

Le panneau Admin peut déclencher le workflow GitHub « Résultats du soir » d'un
clic, via une Edge Function ([`supabase/functions/trigger-results`](supabase/functions/trigger-results/index.ts))
qui vérifie que l'appelant est admin puis appelle l'API GitHub avec un token
gardé **côté serveur** (jamais dans le navigateur).

```bash
# 1. Créer un PAT GitHub fine-grained (permission "Actions: write" sur le dépôt).
# 2. Déclarer les secrets puis déployer la fonction :
npx supabase secrets set GH_DISPATCH_TOKEN=github_pat_xxx GH_REPO=ton-user/mon-petit-velo GH_REF=main
npx supabase functions deploy trigger-results
```

Sans cette config, le bouton renvoie « Déclencheur GitHub non configuré » ; le
calcul des scores reste de toute façon automatique (vue live) dès que les
résultats sont en base.

En local : `npx supabase functions serve trigger-results --env-file supabase/functions/.env`
(voir [`.env.example`](supabase/functions/.env.example)).

### 6. (Optionnel) Rappels de pari par notification push

Chaque joueur active les rappels depuis son **profil** (« 🔔 Rappels de pari »).
Un workflow planifié ([`reminder.yml`](.github/workflows/reminder.yml), ~11h30 Paris,
soit ~30 min avant la clôture) notifie ceux qui n'ont **pas encore parié** l'étape
du jour, via Web Push.

```bash
# Générer une paire de clés VAPID :
npx web-push generate-vapid-keys
```

- **Variable** GitHub (publique) : `VITE_VAPID_PUBLIC_KEY` (= clé publique).
- **Secrets** GitHub : `VAPID_PRIVATE_KEY`, et `VAPID_PUBLIC_KEY` ; **Variables** :
  `VAPID_SUBJECT` (`mailto:toi@exemple.fr`) et `MPV_SITE_URL` (URL GitHub Pages,
  ouverte au clic sur la notif).

> ⚠️ Le cron GitHub n'est pas précis à la minute : le « 30 min avant » est
> approximatif. Les notifications nécessitent que le joueur ait autorisé le site
> dans son navigateur (par appareil).

---

## Tester en local (100 % hors-ligne, sans rien dans le cloud)

Prérequis : **Docker** (en marche) + **Node**. Le CLI Supabase se lance via `npx`.

```bash
# 1. Démarrer la stack Supabase locale (Postgres + Auth + Studio).
#    Applique les migrations ET supabase/seed.sql (étape de démo + côtes).
npx supabase start          # 1re fois : télécharge les images Docker
npx supabase db reset       # pour ré-appliquer migrations + seed à tout moment

# 2. Lancer le front (le .env.local pointe déjà vers la stack locale).
cd web && npm install && npm run dev      # http://localhost:5173
```

`npx supabase start` affiche les **clés locales** : la clé `Publishable`
(= clé front, déjà dans [`web/.env.local`](web/.env.local)) et la clé `Secret`
(= service_role, pour les jobs).

**S'inscrire / se connecter en local** :
- *Créer un compte* : saisis un e-mail → le lien est capturé par **Mailpit**
  (http://127.0.0.1:54324) → clique « Your sign-in link » → tu finalises avec
  pseudo + mot de passe.
- *Se connecter* : e-mail + mot de passe.
- *Mot de passe oublié* : saisis l'e-mail → lien de réinit dans Mailpit
  (« Reset your password ») → choisis un nouveau mot de passe.

> Les e-mails par défaut sont en anglais ; tu peux les traduire dans
> Supabase (Auth > Email Templates) ou dans `supabase/config.toml`.

**Voir le scoring sans attendre une vraie étape** : place un pari sur l'étape du
jour (étape 7), puis dans **Supabase Studio** (http://127.0.0.1:54323) ou en SQL,
enregistre un faux résultat :

```sql
-- Podium de démo (ré-exécutable : on efface puis on réinsère).
delete from stage_results
where stage_id = (select id from stages where season = 2099 and stage_no = 7);

insert into stage_results (stage_id, position, rider_name)
select s.id, v.position, v.rider_name
from stages s
join (values
  (1, 'Tadej Pogačar'),
  (2, 'Jonas Vingegaard'),
  (3, 'Remco Evenepoel')
) as v(position, rider_name) on true
where s.season = 2099 and s.stage_no = 7;

update stages set results_status = 'official' where season = 2099 and stage_no = 7;
```

Le classement et l'historique se mettent à jour immédiatement.

Pour tout arrêter : `npx supabase stop`.

## Calcul des côtes & tests

La côte dépend du **profil d'étape** (sprint/montagne/CLM/vallon) et de la
**forme** du coureur. Le calcul ([`jobs/odds.py`](jobs/odds.py)) est une fonction
**pure** : `force = FORM_WEIGHT × forme + SPEC_WEIGHT × points_dans_la_spécialité_de_l'étape`,
puis `poids = force^ALPHA`, `proba = poids/Σ`, `côte = MARGIN/proba`. Un sprinteur
est donc favori sur le plat, un grimpeur en montagne, etc.

### Trois façons de tester (sans dépendre de PCS)

1. **Tests unitaires** (déterministes, hors-ligne) — la logique étape/forme :
   ```bash
   cd jobs && python tests/test_odds.py     # ou : pytest jobs/tests
   ```
2. **Rejeu d'un instantané** capturé une fois là où PCS répond, puis rejoué partout :
   ```bash
   python fetch_odds.py --stage 1 --save-snapshot snap.json   # capture (réseau)
   python fetch_odds.py --from-snapshot snap.json             # rejeu (hors-ligne)
   ```
3. **Dry-run** — calcule et affiche les côtes sans rien écrire en base :
   ```bash
   python fetch_odds.py --dry-run --stage 1
   ```

### ⚠️ Disponibilité de ProCyclingStats

PCS est derrière Cloudflare : les requêtes depuis des IP « datacenter »
(certains CI) peuvent recevoir un **403**. Depuis une machine perso (IP
résidentielle), la lib `procyclingstats` fonctionne normalement.

- **Avant le Tour**, teste un vrai run depuis ton PC (l'option `--season` évite
  de jongler avec les variables d'environnement, pratique sous PowerShell) :
  ```bash
  cd jobs && pip install -r requirements.txt
  python fetch_odds.py --dry-run --season 2025 --stage 12    # étape de montagne 2025
  python fetch_odds.py --season 2025 --stage 12 --save-snapshot snap.json
  ```
- **Vérifie GitHub Actions** en lançant le workflow « Côtes du matin » à la main
  (*Run workflow*) : si tu vois des 403 dans les logs, l'IP du runner est bloquée.
  Plan B alors : augmenter les retries, ou **saisir les côtes à la main** (admin)
  ce jour-là — le jeu ne casse pas.

## Réglages utiles

- **Côtes** (poids forme/spécialité, écart favoris/outsiders, marge, bornes) :
  variables `MPV_ODDS_*` dans [`jobs/config.py`](jobs/config.py).
- **Accès PCS** (étape, startlist, spécialités, forme, résultats) : tout est isolé
  dans [`jobs/pcs.py`](jobs/pcs.py) — seul fichier à ajuster si `procyclingstats`
  change un nom de méthode. Le calcul ([`jobs/odds.py`](jobs/odds.py)) en est
  découplé et reste testable sans réseau.

## Limites assumées

- Les côtes ne sont **pas** celles de Winamax (aucune API gratuite ne les expose) :
  ce sont des côtes cohérentes dérivées des points PCS.
- Le scraping PCS dépend d'un site tiers ; en cas de souci, relance le workflow
  ou ajuste `jobs/pcs.py`.
