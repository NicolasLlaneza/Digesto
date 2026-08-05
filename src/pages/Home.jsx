import { useEffect, useState } from 'react'
import { buscarDocumentos, obtenerFacetas, POR_PAGINA } from '../lib/documentos'
import BarraFiltros from '../components/BarraFiltros'
import TarjetaDocumento from '../components/TarjetaDocumento'

const FILTROS_INICIALES = {
  numero: '',
  contenido: '',
  tipo: '',
  anio: '',
  pagina: 0,
}

export default function Home() {
  const [filtros, setFiltros] = useState(FILTROS_INICIALES)
  const [facetas, setFacetas] = useState({ tipos: [], anios: [] })
  const [resultado, setResultado] = useState({ documentos: [], total: 0 })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    obtenerFacetas()
      .then(setFacetas)
      .catch(() => {
        // Sin facetas los selects quedan vacíos, pero se puede seguir
        // buscando por número y por contenido.
      })
  }, [])

  useEffect(() => {
    // Se espera a que el usuario deje de tipear para no lanzar una consulta
    // por tecla.
    const t = setTimeout(async () => {
      setCargando(true)
      setError(null)
      try {
        setResultado(await buscarDocumentos(filtros))
      } catch (e) {
        setError(e.message)
      } finally {
        setCargando(false)
      }
    }, 300)

    return () => clearTimeout(t)
  }, [filtros])

  const paginas = Math.ceil(resultado.total / POR_PAGINA)

  return (
    <>
      <BarraFiltros
        filtros={filtros}
        facetas={facetas}
        onCambio={setFiltros}
        onLimpiar={() => setFiltros(FILTROS_INICIALES)}
      />

      {error && (
        <p role="alert" className="rounded-md bg-red-50 text-red-800 px-4 py-3 text-sm">
          No se pudo cargar el listado: {error}
        </p>
      )}

      {cargando && <p className="text-sm text-boletin-600">Buscando…</p>}

      {!cargando && !error && resultado.total === 0 && (
        <p className="text-sm text-boletin-600">
          No hay documentos que coincidan con la búsqueda.
        </p>
      )}

      {!cargando && resultado.total > 0 && (
        <>
          <p className="mb-3 text-sm text-boletin-600">
            {resultado.total} {resultado.total === 1 ? 'documento' : 'documentos'}
          </p>

          <div className="space-y-3">
            {resultado.documentos.map((doc) => (
              <TarjetaDocumento key={doc.id} doc={doc} />
            ))}
          </div>

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
                {filtros.pagina + 1} de {paginas}
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
