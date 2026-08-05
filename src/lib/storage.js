import { supabase } from './supabase'

// Las URLs firmadas duran poco, así que se reusan mientras siguen vigentes
// en vez de pedir una nueva por cada click.
const cache = new Map()
const MARGEN_MS = 30_000

/**
 * Pide al backend una URL firmada para descargar el documento.
 *
 * El bucket de R2 es privado: la Edge Function valida la sesión antes de
 * firmar, así que sin login no hay forma de llegar al archivo.
 */
export async function urlDocumento(id) {
  const guardada = cache.get(id)
  if (guardada && guardada.vence > Date.now()) return guardada.url

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No hay sesión activa')

  const respuesta = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/documento-url`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id }),
    }
  )

  if (!respuesta.ok) {
    const { error } = await respuesta.json().catch(() => ({}))
    throw new Error(error ?? 'No se pudo obtener el documento')
  }

  const { url, expira_en } = await respuesta.json()
  cache.set(id, { url, vence: Date.now() + expira_en * 1000 - MARGEN_MS })
  return url
}

/**
 * Descarga el PDF y lo imprime.
 *
 * Se baja como blob en vez de imprimir el iframe del visor porque ese iframe
 * apunta a otro origen, y el navegador no deja invocar print() sobre él. Un
 * blob local sí es del mismo origen.
 */
export async function imprimirDocumento(id) {
  const url = await urlDocumento(id)
  const blob = await (await fetch(url)).blob()
  const local = URL.createObjectURL(blob)

  const marco = document.createElement('iframe')
  marco.style.display = 'none'
  marco.src = local

  marco.onload = () => {
    marco.contentWindow.focus()
    marco.contentWindow.print()
    // El iframe no se puede quitar enseguida: el diálogo de impresión lo
    // necesita vivo mientras está abierto.
    setTimeout(() => {
      marco.remove()
      URL.revokeObjectURL(local)
    }, 60_000)
  }

  document.body.appendChild(marco)
}

export async function descargarDocumento(id, nombre) {
  const url = await urlDocumento(id)
  const blob = await (await fetch(url)).blob()
  const local = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = local
  a.download = `${nombre}.pdf`
  a.click()

  URL.revokeObjectURL(local)
}

export function formatearPeso(bytes) {
  if (!bytes) return ''
  const mb = bytes / 1024 / 1024
  return mb < 1 ? `${Math.round(bytes / 1024)} KB` : `${mb.toFixed(1)} MB`
}
