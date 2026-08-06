import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { obtenerDocumento } from '../lib/documentos'
import {
  urlDocumento,
  descargarDocumento,
  imprimirDocumento,
  formatearPeso,
} from '../lib/storage'

export default function DocumentoDetalle() {
  const { id } = useParams()
  const [doc, setDoc] = useState(null)
  const [urlVisor, setUrlVisor] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let vigente = true

    obtenerDocumento(id)
      .then(async (d) => {
        if (!vigente) return
        setDoc(d)
        if (d.mime === 'application/pdf') {
          setUrlVisor(await urlDocumento(d.id))
        }
      })
      .catch((e) => vigente && setError(e.message))

    return () => { vigente = false }
  }, [id])

  async function accion(fn) {
    setOcupado(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e.message)
    } finally {
      setOcupado(false)
    }
  }

  if (error && !doc) return <p role="alert" className="text-sm text-red-800">{error}</p>
  if (!doc) return <p className="text-sm text-boletin-600">Cargando…</p>

  const accionBtn = 'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm disabled:opacity-50'

  return (
    <article>
      <Link
        to="/digesto"
        className="inline-flex items-center gap-1 text-sm text-boletin-600 hover:underline"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Volver al listado
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">{doc.titulo}</h1>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-boletin-600">
        <div><dt className="inline font-medium">Tipo: </dt>
             <dd className="inline capitalize">{doc.tipo}</dd></div>
        <div><dt className="inline font-medium">Número: </dt>
             <dd className="inline">{doc.numero}/{doc.anio}</dd></div>
        {doc.fecha_sancion && (
          <div><dt className="inline font-medium">Sanción: </dt>
               <dd className="inline">{doc.fecha_sancion}</dd></div>
        )}
        <div><dt className="inline font-medium">Estado: </dt>
             <dd className="inline">{doc.vigente ? 'Vigente' : 'Derogada'}</dd></div>
      </dl>

      {doc.sumario && <p className="mt-4">{doc.sumario}</p>}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={() => accion(() => imprimirDocumento(doc.id))}
          disabled={ocupado}
          className={`${accionBtn} bg-boletin-900 text-white`}
        >
          <Printer size={16} aria-hidden="true" /> Imprimir
        </button>

        <button
          onClick={() => accion(() => descargarDocumento(doc.id))}
          disabled={ocupado}
          className={`${accionBtn} border border-boletin-100 bg-white`}
        >
          <Download size={16} aria-hidden="true" />
          Descargar {formatearPeso(doc.bytes)}
        </button>
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}

      {urlVisor && (
        <iframe
          src={urlVisor}
          title={doc.titulo}
          className="mt-6 w-full h-[75vh] rounded-lg border border-boletin-100 bg-white"
        />
      )}
    </article>
  )
}
