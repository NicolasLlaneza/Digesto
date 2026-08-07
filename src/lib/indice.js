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

// Tope de filas por exportación. Un año entero ronda las 6.300, así que
// alcanza para cualquier búsqueda razonable sin que el navegador tenga que
// sostener un archivo enorme en memoria.
export const TOPE_EXPORTACION = 10_000

const COLUMNAS_EXPORTACION = [
  ['Tipo', (n) => etiquetaTipo(n.tipo)],
  ['Número', (n) => n.numero ?? ''],
  ['Año', (n) => n.anio],
  ['Fecha', (n) => formatearFecha(n.fecha) ?? ''],
  ['Índice', (n) => n.indice ?? ''],
  ['Expediente tipo', (n) => n.exp_tipo ?? ''],
  ['Expediente número', (n) => n.exp_numero ?? ''],
  ['Expediente año', (n) => n.exp_anio ?? ''],
]

/** Escapa un valor para CSV: comillas dobles y encierro si hace falta. */
export function celda(valor) {
  const texto = String(valor ?? '')
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/**
 * Descarga los resultados de una búsqueda como CSV.
 *
 * Trae el resultado completo y no solo la página visible, que es lo que
 * tiene sentido al exportar. Pide los datos sin resaltado: sobre miles de
 * filas ese cálculo domina el tiempo de respuesta, y en un archivo no
 * aporta nada.
 *
 * Devuelve cuántas filas se exportaron y si el tope las recortó.
 */
export async function exportarBusqueda({
  numero, expediente, texto, tipo, anio,
}) {
  const { data, error } = await supabase.rpc('buscar_indice', {
    q: texto?.trim() || null,
    p_numero: numero?.trim() ? Number(numero.trim()) : null,
    p_expediente: expediente?.trim() ? Number(expediente.trim()) : null,
    p_tipo: tipo || null,
    p_anio: anio ? Number(anio) : null,
    p_limite: TOPE_EXPORTACION,
    p_offset: 0,
    p_resaltar: false,
  })

  if (error) throw error
  if (!data?.length) return { filas: 0, recortado: false }

  const lineas = [
    COLUMNAS_EXPORTACION.map(([titulo]) => celda(titulo)).join(';'),
    ...data.map((n) =>
      COLUMNAS_EXPORTACION.map(([, valor]) => celda(valor(n))).join(';')
    ),
  ]

  // Punto y coma como separador, y una marca de orden de bytes al
  // principio: es lo que hace que Excel en español abra el archivo en
  // columnas y respete los acentos, en vez de volcar todo en la primera.
  const contenido = `\uFEFF${lineas.join('\r\n')}\r\n`
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const partes = ['digesto']
  if (texto?.trim()) partes.push(texto.trim().replace(/[^\w\s-]/g, '').slice(0, 40))
  if (tipo) partes.push(tipo)
  if (anio) partes.push(anio)
  if (numero?.trim()) partes.push(`n${numero.trim()}`)
  if (expediente?.trim()) partes.push(`exp${expediente.trim()}`)

  const a = document.createElement('a')
  a.href = url
  a.download = `${partes.join('-').replace(/\s+/g, '_')}.csv`
  a.click()

  // Se libera después: revocar en el mismo turno puede cortar la descarga
  // antes de que el navegador termine de leer el blob.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)

  return { filas: data.length, recortado: data.length === TOPE_EXPORTACION }
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
