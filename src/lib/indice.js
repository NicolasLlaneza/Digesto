import { supabase } from './supabase'

export const POR_PAGINA = 25

const CAMPOS = 'id, tipo, numero, anio, fecha, indice, exp_tipo, exp_numero, exp_anio'

/**
 * Busca en el índice de normas.
 *
 * Los criterios son independientes y se combinan: por número de norma, por
 * número de expediente, o por lo que dice el índice. Sin año seleccionado
 * busca en todos los cargados, que es el caso habitual —quien busca un
 * expediente rara vez sabe de qué año salió la norma que lo resolvió.
 */
export async function buscarNormas({
  numero, expediente, texto, tipo, anio, pagina = 0,
}) {
  let q = supabase.from('indice_normas').select(CAMPOS, { count: 'exact' })

  if (numero?.trim()) q = q.eq('numero', Number(numero.trim()))
  if (expediente?.trim()) q = q.eq('exp_numero', Number(expediente.trim()))

  if (texto?.trim()) {
    q = q.textSearch('busqueda', texto.trim(), {
      type: 'websearch',
      config: 'spanish',
    })
  }

  if (tipo) q = q.eq('tipo', tipo)
  if (anio) q = q.eq('anio', Number(anio))

  const desde = pagina * POR_PAGINA
  const { data, error, count } = await q
    .order('anio', { ascending: false })
    .order('numero', { ascending: false })
    .range(desde, desde + POR_PAGINA - 1)

  if (error) throw error
  return { normas: data ?? [], total: count ?? 0 }
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
