# 🚀 Déploiement de MPV

Tout ce qui est automatisable est déjà prêt (code, migrations, workflows, schéma
consolidé, tests verts). Il te reste à **créer les comptes et coller les clés**.
Compter ~20 min.

---

## A. Supabase (base + auth) — gratuit

1. Crée un projet sur [supabase.com](https://supabase.com) (région **EU** conseillée).
2. **SQL Editor → New query** → colle tout [`supabase/schema_all.sql`](supabase/schema_all.sql) → **Run**.
   (C'est l'ensemble des migrations `0001`→`0005`, ré-exécutable sans risque.)
   - ⚠️ Ne lance **pas** `seed_demo_history.sql` en prod (ce sont des données de démo).
3. **Authentication → Providers → Email** : activer, méthode **mot de passe**.
   *Confirm email* : à ton choix (ON = plus sûr ; OFF = connexion immédiate).
4. **Authentication → Email Templates** : colle le HTML de [`supabase/templates/`](supabase/templates/)
   (`magic_link`, `confirmation`, `recovery`) pour des e-mails aux couleurs MPV.
5. **Authentication → URL Configuration** :
   - *Site URL* : `https://<user>.github.io/mon-petit-velo/`
   - *Redirect URLs* : la même + `http://localhost:5173` (pour le dev).
6. **Project Settings → API** : note ces 3 valeurs (étape B) :
   - `Project URL`  → `SUPABASE_URL` **et** `VITE_SUPABASE_URL`
   - clé `anon` `public` → `VITE_SUPABASE_ANON_KEY`
   - clé `service_role` (🔒 JWT `eyJ…`) → `SUPABASE_SERVICE_KEY`

## B. GitHub (front + jobs)

1. Crée le dépôt et pousse :
   ```bash
   git remote add origin https://github.com/<user>/mon-petit-velo.git
   git branch -M main
   git push -u origin main
   ```
2. **Settings → Pages** : *Source* = **GitHub Actions**.
3. Génère une paire VAPID (notifications push) :
   ```bash
   npx web-push generate-vapid-keys
   ```
4. **Settings → Secrets and variables → Actions** — renseigne :

   **Secrets** (sensibles) :
   | Nom | Valeur |
   |-----|--------|
   | `VITE_SUPABASE_URL` | Project URL Supabase |
   | `VITE_SUPABASE_ANON_KEY` | clé anon public |
   | `SUPABASE_URL` | Project URL Supabase (idem) |
   | `SUPABASE_SERVICE_KEY` | clé **service_role** (JWT) |
   | `VAPID_PUBLIC_KEY` | clé publique VAPID |
   | `VAPID_PRIVATE_KEY` | clé privée VAPID |

   **Variables** (non sensibles) :
   | Nom | Valeur |
   |-----|--------|
   | `VITE_VAPID_PUBLIC_KEY` | **même** clé publique VAPID |
   | `MPV_SEASON` | `2026` |
   | `MPV_RACE_SLUG` | `tour-de-france` |
   | `VAPID_SUBJECT` | `mailto:ton-email@exemple.fr` |
   | `MPV_SITE_URL` | `https://<user>.github.io/mon-petit-velo/` |
   | `VITE_MPV_ACTIONS_URL` | *(optionnel)* `https://github.com/<user>/mon-petit-velo/actions/workflows/results.yml` |

5. Le push sur `main` déclenche [`deploy.yml`](.github/workflows/deploy.yml) → le site est en ligne.

## C. Premier admin

Crée ton compte dans l'appli (e-mail + mot de passe + pseudo), puis dans
**Supabase → SQL Editor** :
```sql
update public.profiles set is_admin = true where email = 'admin@exemple.fr';
```

## D. (Optionnel) Bouton admin « Récupérer les résultats »

```bash
npx supabase link --project-ref <ref>
npx supabase secrets set GH_DISPATCH_TOKEN=github_pat_xxx GH_REPO=<user>/mon-petit-velo GH_REF=main
npx supabase functions deploy trigger-results
```
(PAT GitHub *fine-grained*, permission **Actions: write** sur le dépôt.)

---

## Vérifications après déploiement

- [ ] Le site charge sur `https://<user>.github.io/mon-petit-velo/` (création de compte par e-mail OK).
- [ ] **Test PCS depuis Actions** : onglet **Actions → « Côtes (veille au soir) » → Run workflow**.
  - Hors période du Tour, mets `offset_days = 0` ; il dira « aucune étape » (normal) mais
    surtout : **vérifie qu'il n'y a pas de 403** dans les logs (sinon l'IP du runner est
    bloquée par PCS → plan B : retries, proxy, ou saisie admin).
  - Idéalement, teste pendant une course en cours (ex. une étape du jour d'une course 2026)
    pour voir de vraies côtes.
- [ ] Pendant le Tour : les côtes se publient **la veille à 20h** (cron), la deadline reste **midi**.

## Planification (déjà configurée dans les workflows)

| Workflow | Quand (Paris) | cron UTC |
|----------|---------------|----------|
| Côtes (veille, `--offset-days 1`) | 20h00 | `0 18 * * *` |
| Résultats | 19h30 & 22h00 | `30 17 * * *`, `0 20 * * *` |
| Rappel push | 11h30 | `30 9 * * *` |

> ⚠️ Crons en UTC, calés sur l'été (CEST = UTC+2). Hors été, décaler d'1 h.
