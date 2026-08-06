import { useState } from 'react'
import { FileText, Calendar, FolderOpen, ChevronDown } from 'lucide-react'
import { etiquetaTipo, formatearFecha, tramosResaltados } from '../lib/indice'

// A partir de este largo el índice se recorta: la mediana ronda los 550
// caracteres y hay textos de 2500, que aplastarían el listado.
const RECORTE = 320

function Resaltado({ texto }) {
  return tramosResaltados(texto).map(({ clave, coincide, texto: tramo }) =>
    coincide ? (
      <mark key={clave} className="bg-amber-200/70 text-boletin-900 rounded px-0.5">
        {tramo}
      </mark>
    ) : (
      <span key={clave}>{tramo}</span>
    )
  )
}

export default function FichaNorma({ norma }) {
  const [abierto, setAbierto] = useState(false)

  // Con búsqueda de texto se muestra el fragmento resaltado, que ya viene
  // recortado alrededor de las coincidencias: mostrar el principio del
  // índice escondería justamente lo que la persona buscaba.
  const hayResaltado = Boolean(norma.resaltado)
  const completo = norma.indice ?? ''
  const largo = !hayResaltado && completo.length > RECORTE

  const fecha = formatearFecha(norma.fecha)

  return (
    <article className="bg-white rounded-lg border border-boletin-100 p-4">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-semibold">
          {etiquetaTipo(norma.tipo)} N° {norma.numero ?? '—'}/{norma.anio}
        </h2>

        {fecha && (
          <span className="inline-flex items-center gap-1 text-xs text-boletin-600">
            <Calendar size={13} aria-hidden="true" />
            {fecha}
          </span>
        )}

        {norma.exp_numero && (
          <span className="inline-flex items-center gap-1 text-xs text-boletin-600">
            <FolderOpen size={13} aria-hidden="true" />
            Expediente {norma.exp_tipo} {norma.exp_numero}
            {norma.exp_anio ? `/${norma.exp_anio}` : ''}
          </span>
        )}
      </header>

      {completo ? (
        <>
          <p className="mt-2 text-sm leading-relaxed text-boletin-800">
            {hayResaltado && !abierto ? (
              <Resaltado texto={norma.resaltado} />
            ) : largo && !abierto ? (
              `${completo.slice(0, RECORTE).trimEnd()}…`
            ) : (
              completo
            )}
          </p>

          {(largo || hayResaltado) && (
            <button
              onClick={() => setAbierto((v) => !v)}
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-boletin-600
                         hover:underline"
            >
              <ChevronDown
                size={13}
                aria-hidden="true"
                className={`transition-transform ${abierto ? 'rotate-180' : ''}`}
              />
              {abierto ? 'Ver menos' : 'Ver texto completo'}
            </button>
          )}
        </>
      ) : (
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-boletin-600/70">
          <FileText size={14} aria-hidden="true" />
          Sin índice cargado en la planilla de origen
        </p>
      )}
    </article>
  )
}
