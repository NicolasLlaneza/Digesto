import { supabase } from './supabase'

export const POR_PAGINA = 20

/**
 * Busca documentos aplicando los filtros de la UI.
 *
 * La búsqueda de texto usa el índice GIN sobre la columna generada `busqueda`,
 * así que filtra en Postgres y no trae el corpus al cliente.
 */
export async function buscarDocumentos({ texto, tipo, anio, pagina = 0 }) {
  let q = supabase
    .from('documentos')
    .select('id, tipo, numero, anio, titulo, sumario, tags, r2_key, bytes, vigente',
            { count: 'exact' })

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
  return { documentos: data ?? [], total: count ?? 0 }
}

export async function obtenerDocumento(id) {
  const { data, error } = await supabase
    .from('documentos')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

/** Años y tipos presentes, para poblar los selects de filtro. */
export async function obtenerFacetas() {
  const { data, error } = await supabase
    .from('documentos')
    .select('tipo, anio')

  if (error) throw error

  return {
    tipos: [...new Set(data.map((d) => d.tipo))].sort(),
    anios: [...new Set(data.map((d) => d.anio))].sort((a, b) => b - a),
  }
}
