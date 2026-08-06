import { supabase } from './supabase'

export const POR_PAGINA = 25

// Marcas con que la base envuelve los términos que coincidieron. Se eligen
// caracteres que no aparecen en el texto de las normas, para poder partir
// por ellos sin riesgo de cortar donde no corresponde.
export const MARCA_INICIO = '«'
export const MARCA_FIN = '»'

/**
 * Busca en el índice de normas.
 *
 * Va contra una función de la base en lugar de armar la consulta acá: así el
 * orden por relevancia, el resaltado de coincidencias y el total vienen en
 * una sola ida, y el conteo se resuelve del modo más barato según los
 * filtros aplicados.
 *
 * El total llega solo al pedir la primera página, porque no cambia mientras
 * se pagina; quien llama lo conserva.
 */
export async function buscarNormas({
  numero, expediente, texto, tipo, anio, pagina = 0,
}) {
  const { data, error } = await supabase.rpc('buscar_indice', {
    q: texto?.trim() || null,
    p_numero: numero?.trim() ? Number(numero.trim()) : null,
    p_expediente: expediente?.trim() ? Number(expediente.trim()) : null,
    p_tipo: tipo || null,
    p_anio: anio ? Number(anio) : null,
    p_limite: POR_PAGINA,
    p_offset: pagina * POR_PAGINA,
  })

  if (error) throw error

  return {
    normas: data ?? [],
    total: data?.[0]?.total ?? null,
  }
}

export async function obtenerFacetasIndice() {
  const { data, error } = await supabase.rpc('facetas_indice')
  if (error) throw error

  return {
    tipos: [...new Set(data.map((d) => d.tipo))].sort(),
    anios: [...new Set(data.map((d) => d.anio))].sort((a, b) => b - a),
  }
}

const ETIQUETAS = {
  decreto: 'Decreto',
  resolucion: 'Resolución',
  // Serie propia en las planillas viejas, con su numeración aparte: se
  // mantiene separada para que no colisione con las resoluciones generales.
  resolucion_personal: 'Resolución de Personal',
  ordenanza: 'Ordenanza',
  disposicion: 'Disposición',
}

export function etiquetaTipo(tipo) {
  return ETIQUETAS[tipo] ?? tipo
}

export function formatearFecha(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

/**
 * Parte el texto resaltado en tramos, marcando cuáles coincidieron.
 *
 * Se devuelven tramos en vez de HTML para poder pintarlos con elementos de
 * React: insertar el texto de la base como HTML permitiría que el contenido
 * de una norma inyectara marcado en la página.
 */
export function tramosResaltados(texto) {
  if (!texto) return []

  return texto
    .split(new RegExp(`(${MARCA_INICIO}[^${MARCA_FIN}]*${MARCA_FIN})`, 'g'))
    .filter(Boolean)
    .map((tramo, i) => {
      const coincide =
        tramo.startsWith(MARCA_INICIO) && tramo.endsWith(MARCA_FIN)
      return {
        clave: i,
        coincide,
        texto: coincide ? tramo.slice(1, -1) : tramo,
      }
    })
}
