import { Link } from 'react-router-dom'
import { FileText, Download } from 'lucide-react'
import { urlDocumento, formatearPeso } from '../lib/storage'

export default function TarjetaDocumento({ doc }) {
  return (
    <article className="bg-white rounded-lg border border-boletin-100 p-4
                        flex items-start gap-4">
      <FileText size={20} aria-hidden="true" className="mt-1 shrink-0 text-boletin-600" />

      <div className="min-w-0 flex-1">
        <Link
          to={`/documento/${doc.id}`}
          className="font-medium hover:underline break-words"
        >
          {doc.titulo}
        </Link>

        {doc.sumario && (
          <p className="mt-1 text-sm text-boletin-600 line-clamp-2">{doc.sumario}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-boletin-600">
          <span className="rounded bg-boletin-50 px-2 py-0.5 capitalize">{doc.tipo}</span>
          <span>{doc.anio}</span>
          {doc.bytes > 0 && <span>{formatearPeso(doc.bytes)}</span>}
          {!doc.vigente && (
            <span className="rounded bg-amber-100 text-amber-800 px-2 py-0.5">
              Derogada
            </span>
          )}
        </div>
      </div>

      <a
        href={urlDocumento(doc.r2_key)}
        target="_blank"
        rel="noreferrer"
        aria-label={`Descargar ${doc.titulo}`}
        className="shrink-0 rounded-md p-2 text-boletin-600 hover:bg-boletin-50"
      >
        <Download size={18} aria-hidden="true" />
      </a>
    </article>
  )
}
