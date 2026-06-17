import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Message explicite plutôt qu'un crash obscur si la config manque.
  console.error(
    'Config manquante : définis VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY ' +
    '(.env.local en dev, variables CI/CD pour la prod).'
  )
}

export const supabase = createClient(url, anonKey)
