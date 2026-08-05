const base = import.meta.env.VITE_R2_PUBLIC_URL?.replace(/\/$/, '')

/**
 * URL pública de un documento en R2.
 *
 * El bucket sirve los archivos directamente, sin pasar por Supabase ni por
 * ningún backend: por eso el storage de Supabase se mantiene en cero y las
 * descargas no generan costo de egress.
 */
export function urlDocumento(r2Key) {
  if (!base) throw new Error('Falta VITE_R2_PUBLIC_URL en .env')
  // Cada segmento se codifica por separado para no romper las barras de la key.
  return `${base}/${r2Key.split('/').map(encodeURIComponent).join('/')}`
}

export function formatearPeso(bytes) {
  if (!bytes) return ''
  const mb = bytes / 1024 / 1024
  return mb < 1 ? `${Math.round(bytes / 1024)} KB` : `${mb.toFixed(1)} MB`
}
