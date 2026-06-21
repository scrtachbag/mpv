// Edge Function : déclenche le workflow GitHub Actions "Résultats du soir".
//
// Sécurité : le token GitHub reste côté serveur (jamais dans le navigateur).
// La fonction vérifie que l'appelant est un admin (profiles.is_admin) avant
// de demander à GitHub de lancer le workflow results.yml.
//
// Secrets attendus (supabase secrets set ... / supabase/functions/.env en local) :
//   GH_DISPATCH_TOKEN  PAT fine-grained avec la permission "Actions: write" sur le dépôt
//   GH_REPO            "owner/mon-petit-velo"
//   GH_REF             branche (défaut: main)
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    // 1) Vérifier que l'appelant est un admin (via son JWT).
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return json({ error: 'Non authentifié.' }, 401)

    const { data: profile } = await supabase
      .from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
    if (!profile?.is_admin) return json({ error: 'Action réservée à l’admin.' }, 403)

    // 2) Préparer l'appel GitHub.
    const token = Deno.env.get('GH_DISPATCH_TOKEN')
    const repo = Deno.env.get('GH_REPO')
    const ref = Deno.env.get('GH_REF') ?? 'main'
    if (!token || !repo) {
      return json({ error: 'Déclencheur GitHub non configuré (GH_DISPATCH_TOKEN / GH_REPO).' }, 501)
    }

    const { stage_no } = await req.json().catch(() => ({}))
    const inputs: Record<string, string> = {}
    if (stage_no) inputs.stage_no = String(stage_no)

    // 3) workflow_dispatch sur results.yml.
    const ghResp = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/results.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'mpv-admin',
        },
        body: JSON.stringify({ ref, inputs }),
      },
    )
    if (!ghResp.ok) {
      const detail = await ghResp.text()
      return json({ error: `GitHub a répondu ${ghResp.status}.`, detail }, 502)
    }
    return json({ ok: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
