import { supabase } from './supabase'

export const POR_PAGINA = 20

const CAMPOS = 'id, tipo, numero, anio, titulo, sumario, tags, r2_key, bytes, vigente'

/**
 * Busca documentos combinando los filtros de la UI.
 *
 * Los dos modos de búsqueda son independientes y se pueden combinar: por
 * número (para ir a un decreto concreto) y por contenido (para encontrar
 * normativa sobre un tema). Sin año seleccionado busca en todos los cargados.
 */
export async function buscarDocumentos({ numero, contenido, tipo, anio, pagina = 0 }) {
  let q = supabase.from('documentos').select(CAMPOS, { count: 'exact' })

  // El número se guarda como texto porque hay expedientes con letras, así que
  // se compara como texto y no numéricamente.
  if (numero?.trim()) q = q.eq('numero', numero.trim().replace(/^0+/, ''))

  if (contenido?.trim()) {
    q = q.textSearch('busqueda', contenido.trim(), {
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

/**
 * Tipos y años presentes, para poblar los selects.
 *
 * Se consulta una vista agregada en lugar de traer las 5700+ filas y hacer el
 * distinct en el navegador.
 */
export async function obtenerFacetas() {
  const { data, error } = await supabase.rpc('facetas_documentos')
  if (error) throw error

  return {
    tipos: [...new Set(data.map((d) => d.tipo))].sort(),
    anios: [...new Set(data.map((d) => d.anio))].sort((a, b) => b - a),
  }
}
