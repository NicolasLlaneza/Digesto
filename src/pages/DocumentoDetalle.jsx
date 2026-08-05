import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import { obtenerDocumento } from '../lib/documentos'
import { urlDocumento, formatearPeso } from '../lib/storage'

export default function DocumentoDetalle() {
  const { id } = useParams()
  const [doc, setDoc] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    obtenerDocumento(id).then(setDoc).catch((e) => setError(e.message))
  }, [id])

  if (error) return <p className="text-sm text-red-800">No se encontró el documento.</p>
  if (!doc) return <p className="text-sm text-boletin-600">Cargando…</p>

  const url = urlDocumento(doc.r2_key)

  return (
    <article>
      <Link
        to="/"
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

      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-boletin-900
                   px-4 py-2 text-sm text-white"
      >
        <Download size={16} aria-hidden="true" />
        Descargar {formatearPeso(doc.bytes)}
      </a>

      {doc.mime === 'application/pdf' && (
        <iframe
          src={url}
          title={doc.titulo}
          className="mt-6 w-full h-[75vh] rounded-lg border border-boletin-100 bg-white"
        />
      )}
    </article>
  )
}
