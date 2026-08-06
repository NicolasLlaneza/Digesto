import { supabase, URL_BASE } from './supabase'

// Las URLs firmadas duran poco, así que se reusan mientras siguen vigentes
// en vez de pedir una nueva por cada click.
const cache = new Map()
const MARGEN_MS = 30_000

/**
 * Pide al backend una URL firmada para el documento.
 *
 * El bucket de R2 es privado: la Edge Function valida la sesión antes de
 * firmar, así que sin login no hay forma de llegar al archivo.
 *
 * Con `descarga`, la URL viene preparada para que R2 mande el archivo como
 * adjunto en lugar de mostrarlo.
 */
export async function urlDocumento(id, { descarga = false } = {}) {
  const clave = `${id}:${descarga}`
  const guardada = cache.get(clave)
  if (guardada && guardada.vence > Date.now()) return guardada.url

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No hay sesión activa')

  const respuesta = await fetch(`${URL_BASE}/functions/v1/documento-url`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, descarga }),
  })

  if (!respuesta.ok) {
    const { error } = await respuesta.json().catch(() => ({}))
    throw new Error(error ?? 'No se pudo obtener el documento')
  }

  const { url, expira_en } = await respuesta.json()
  cache.set(clave, { url, vence: Date.now() + expira_en * 1000 - MARGEN_MS })
  return url
}

/**
 * Descarga el documento.
 *
 * Se navega a la URL en lugar de traer el archivo con fetch: la URL firmada
 * ya trae el Content-Disposition que hace que el navegador lo baje, así que
 * la descarga no depende de la política CORS del bucket ni carga el archivo
 * entero en memoria.
 */
export async function descargarDocumento(id) {
  const url = await urlDocumento(id, { descarga: true })

  const a = document.createElement('a')
  a.href = url
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/**
 * Imprime el documento.
 *
 * Imprimir sí necesita el archivo en un blob: el navegador no permite invocar
 * print() sobre un iframe de otro origen, y un blob local sí es del mismo
 * origen. Eso exige que el bucket permita el origen de la app por CORS.
 *
 * Si el fetch falla —CORS mal configurado, típicamente— se abre el PDF en una
 * pestaña, donde el visor del navegador ofrece su propio botón de imprimir.
 * Es un paso más para el usuario, pero no deja la acción sin resolver.
 */
export async function imprimirDocumento(id) {
  const url = await urlDocumento(id)

  let local
  try {
    const respuesta = await fetch(url)
    if (!respuesta.ok) throw new Error(`R2 respondió ${respuesta.status}`)
    local = URL.createObjectURL(await respuesta.blob())
  } catch (e) {
    console.warn('No se pudo imprimir en la página, se abre en una pestaña:', e)
    window.open(url, '_blank', 'noopener')
    return
  }

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

export function formatearPeso(bytes) {
  if (!bytes) return ''
  const mb = bytes / 1024 / 1024
  return mb < 1 ? `${Math.round(bytes / 1024)} KB` : `${mb.toFixed(1)} MB`
}
