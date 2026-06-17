import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' => les assets sont chargés en chemin relatif, ce qui fonctionne
// que le site soit servi à la racine ou sous un sous-chemin (GitLab Pages :
// https://<user>.gitlab.io/<repo>/).
export default defineConfig({
  plugins: [react()],
  base: './',
})
