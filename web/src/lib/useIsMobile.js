import { useEffect, useState } from 'react'

// Vrai sur téléphone (largeur <= 640px, même breakpoint que le CSS mobile).
// Se met à jour au redimensionnement / rotation.
export function useIsMobile(query = '(max-width: 640px)') {
  const get = () => typeof window !== 'undefined' && window.matchMedia(query).matches
  const [isMobile, setIsMobile] = useState(get)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setIsMobile(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return isMobile
}
