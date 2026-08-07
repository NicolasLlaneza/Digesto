import { useEffect, useState } from 'react'
import { Search, Hash, FolderOpen, X, Scale, Download } from 'lucide-react'
import {
  buscarNormas, obtenerFacetasIndice, exportarBusqueda,
  etiquetaTipo, POR_PAGINA,
} from '../lib/indice'
import FichaNorma from '../components/FichaNorma'

const INICIALES = {
  numero: '', expediente: '', texto: '', tipo: '', anio: '', pagina: 0,
}

const control = 'rounded-md border border-boletin-100 bg-white px-3 py-2 text-sm'

/** True si hay algún criterio de búsqueda cargado. */
function hayCriterio({ numero, expediente, texto, tipo, anio }) {
  return Boolean(numero || expediente || texto || tipo || anio)
}

/** Parte el listado en tramos consecutivos del mismo año. */
function agruparPorAnio(normas) {
  return normas.reduce((grupos, norma) => {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.anio === norma.anio) ultimo.normas.push(norma)
    else grupos.push({ anio: norma.anio, normas: [norma] })
    return grupos
  }, [])
}

export default function Indice() {
  const [filtros, setFiltros] = useState(INICIALES)
  const [facetas, setFacetas] = useState({ tipos: [], anios: [] })
  const [resultado, setResultado] = useState({ normas: [], total: 0 })
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [exportando, setExportando] = useState(false)
  const [aviso, setAviso] = useState(null)

  const buscando = hayCriterio(filtros)

  useEffect(() => {
    obtenerFacetasIndice().then(setFacetas).catch(() => {
      // Sin facetas los selects quedan vacíos, pero se puede seguir buscando.
    })
  }, [])

  useEffect(() => {
    // Sin criterio no se consulta nada: traer las primeras 25 de 84 mil no
    // le sirve a nadie y hace pagar el conteo completo en cada visita.
    if (!buscando) {
      setResultado({ normas: [], total: 0 })
      setCargando(false)
      return
    }

    const t = setTimeout(async () => {
      setCargando(true)
      setError(null)
      setAviso(null)
      try {
        const nuevo = await buscarNormas(filtros)
        // El total llega solo en la primera página. Al paginar se conserva
        // el anterior, porque cambiar de página no cambia cuántos hay.
        setResultado((previo) => ({
          normas: nuevo.normas,
          total: nuevo.total ?? previo.total,
        }))
      } catch (e) {
        setError(`No se pudo consultar el índice: ${e.message}`)
      } finally {
        setCargando(false)
      }
    }, 300)

    return () => clearTimeout(t)
  }, [filtros, buscando])

  const set = (campo) => (e) =>
    setFiltros((f) => ({ ...f, [campo]: e.target.value, pagina: 0 }))

  async function exportar() {
    setExportando(true)
    setAviso(null)
    try {
      const { filas, recortado } = await exportarBusqueda(filtros)
      if (recortado) {
        setAviso(
          `Se exportaron las primeras ${filas.toLocaleString('es-AR')} normas, ` +
          `que es el tope por archivo. Acotá la búsqueda para incluirlas todas.`
        )
      }
    } catch (e) {
      setError(`No se pudo exportar: ${e.message}`)
    } finally {
      setExportando(false)
    }
  }

  const paginas = Math.ceil(resultado.total / POR_PAGINA)
  const grupos = agruparPorAnio(resultado.normas)

  return (
    <>
      <div className="bg-white rounded-lg border border-boletin-100 p-4 mb-6">
        <div className="relative">
          <Search
            size={16}
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-boletin-600"
          />
          <input
            type="search"
            value={filtros.texto}
            onChange={set('texto')}
            placeholder="Buscar en el texto del índice…"
            aria-label="Buscar por contenido"
            className={`${control} w-full pl-9`}
            autoFocus
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Hash
              size={15}
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-boletin-600"
            />
            <input
              type="text"
              inputMode="numeric"
              value={filtros.numero}
              onChange={set('numero')}
              placeholder="N° de norma"
              aria-label="Número de norma"
              className={`${control} w-full pl-9`}
            />
          </div>

          <div className="relative">
            <FolderOpen
              size={15}
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-boletin-600"
            />
            <input
              type="text"
              inputMode="numeric"
              value={filtros.expediente}
              onChange={set('expediente')}
              placeholder="N° de expediente"
              aria-label="Número de expediente"
              className={`${control} w-full pl-9`}
            />
          </div>

          <select value={filtros.tipo} onChange={set('tipo')}
                  aria-label="Tipo de norma" className={control}>
            <option value="">Todos los tipos</option>
            {facetas.tipos.map((t) => (
              <option key={t} value={t}>{etiquetaTipo(t)}</option>
            ))}
          </select>

          <select value={filtros.anio} onChange={set('anio')}
                  aria-label="Año" className={control}>
            <option value="">Todos los años</option>
            {facetas.anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {buscando && (
          <button
            onClick={() => setFiltros(INICIALES)}
            className="mt-3 inline-flex items-center gap-1 text-sm text-boletin-600
                       hover:underline"
          >
            <X size={14} aria-hidden="true" /> Limpiar filtros
          </button>
        )}
      </div>

      {!buscando && (
        <div className="text-center py-16">
          <Scale size={32} aria-hidden="true" className="mx-auto text-boletin-600/40" />
          <p className="mt-4 text-boletin-600">
            Buscá por número de norma, por expediente o por lo que dice el índice.
          </p>
          {facetas.anios.length > 0 && (
            <p className="mt-2 text-sm text-boletin-600/70">
              Hay normas cargadas de {facetas.anios[facetas.anios.length - 1]} a{' '}
              {facetas.anios[0]}.
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-red-50 text-red-800 px-4 py-3 text-sm">
          {error}
        </p>
      )}

      {buscando && cargando && <p className="text-sm text-boletin-600">Buscando…</p>}

      {buscando && !cargando && !error && resultado.total === 0 && (
        <p className="text-sm text-boletin-600">
          No hay normas que coincidan con la búsqueda.
        </p>
      )}

      {buscando && !cargando && resultado.total > 0 && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <p className="text-sm text-boletin-600">
              {resultado.total.toLocaleString('es-AR')}{' '}
              {resultado.total === 1 ? 'norma' : 'normas'}
            </p>

            <button
              onClick={exportar}
              disabled={exportando}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md border
                         border-boletin-100 bg-white px-3 py-1.5 text-sm
                         text-boletin-600 hover:bg-boletin-50 disabled:opacity-50"
            >
              <Download size={15} aria-hidden="true" />
              {exportando ? 'Preparando…' : 'Exportar a CSV'}
            </button>
          </div>

          {aviso && (
            <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {aviso}
            </p>
          )}

          {grupos.map(({ anio, normas }) => (
            <section key={anio} className="mb-6">
              <h2 className="sticky top-0 z-10 -mx-1 mb-3 bg-boletin-50/95 px-1 py-1.5
                             text-sm font-semibold text-boletin-600
                             backdrop-blur border-b border-boletin-100">
                {anio}
                <span className="ml-2 font-normal text-boletin-600/70">
                  {normas.length} en esta página
                </span>
              </h2>

              <div className="space-y-3">
                {normas.map((n) => <FichaNorma key={n.id} norma={n} />)}
              </div>
            </section>
          ))}

          {paginas > 1 && (
            <nav className="mt-6 flex items-center justify-center gap-4 text-sm">
              <button
                onClick={() => setFiltros((f) => ({ ...f, pagina: f.pagina - 1 }))}
                disabled={filtros.pagina === 0}
                className="rounded-md border border-boletin-100 bg-white px-3 py-1.5
                           disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-boletin-600">
                {filtros.pagina + 1} de {paginas.toLocaleString('es-AR')}
              </span>
              <button
                onClick={() => setFiltros((f) => ({ ...f, pagina: f.pagina + 1 }))}
                disabled={filtros.pagina >= paginas - 1}
                className="rounded-md border border-boletin-100 bg-white px-3 py-1.5
                           disabled:opacity-40"
              >
                Siguiente
              </button>
            </nav>
          )}
        </>
      )}
    </>
  )
}
