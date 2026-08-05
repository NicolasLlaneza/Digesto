import { createClient } from '@supabase/supabase-js'

const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Deja la URL del proyecto en su forma base.
 *
 * El panel de Supabase muestra el endpoint REST como
 * `https://<ref>.supabase.co/rest/v1`, y copiar ese en lugar del Project URL
 * es un error fácil de cometer y difícil de ver: el cliente le antepone esa
 * ruta a todo, así que el login termina pegándole a `/rest/v1/auth/v1/token`
 * y el 404 no dice en ningún lado que el problema es la variable.
 */
function urlBase(valor) {
  if (!valor) {
    throw new Error('Falta VITE_SUPABASE_URL. Copiá .env.example a .env.')
  }

  let url
  try {
    url = new URL(valor)
  } catch {
    throw new Error(
      `VITE_SUPABASE_URL no es una URL válida: "${valor}". ` +
        'Tiene que ser https://<ref>.supabase.co'
    )
  }

  if (url.pathname !== '/' && url.pathname !== '') {
    console.warn(
      `VITE_SUPABASE_URL incluía la ruta "${url.pathname}", que se ignora. ` +
        `Dejala en "${url.origin}".`
    )
  }

  return url.origin
}

if (!anonKey) {
  throw new Error('Falta VITE_SUPABASE_ANON_KEY. Copiá .env.example a .env.')
}

// Base ya normalizada, para que todo el que arme URLs contra el proyecto
// —incluida la Edge Function— parta del mismo valor.
export const URL_BASE = urlBase(import.meta.env.VITE_SUPABASE_URL)

// La sesión se persiste para no pedir login en cada recarga.
export const supabase = createClient(URL_BASE, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
