import { Search, Hash, X } from 'lucide-react'

const control = 'rounded-md border border-boletin-100 bg-white px-3 py-2 text-sm'

export default function BarraFiltros({ filtros, facetas, onCambio, onLimpiar }) {
  const set = (campo) => (e) =>
    onCambio({ ...filtros, [campo]: e.target.value, pagina: 0 })

  const hayFiltros = filtros.numero || filtros.contenido || filtros.tipo || filtros.anio

  return (
    <div className="bg-white rounded-lg border border-boletin-100 p-4 mb-6">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Hash
            size={16}
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-boletin-600"
          />
          <input
            type="text"
            inputMode="numeric"
            value={filtros.numero}
            onChange={set('numero')}
            placeholder="Número de decreto o resolución"
            aria-label="Número"
            className={`${control} w-full pl-9`}
          />
        </div>

        <select
          value={filtros.tipo}
          onChange={set('tipo')}
          aria-label="Tipo de norma"
          className={control}
        >
          <option value="">Todos los tipos</option>
          {facetas.tipos.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>

        <select
          value={filtros.anio}
          onChange={set('anio')}
          aria-label="Año"
          className={control}
        >
          <option value="">Todos los años</option>
          {facetas.anios.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="relative mt-3">
        <Search
          size={16}
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-boletin-600"
        />
        <input
          type="search"
          value={filtros.contenido}
          onChange={set('contenido')}
          placeholder="Buscar dentro del texto de las normas…"
          aria-label="Buscar por contenido"
          className={`${control} w-full pl-9`}
        />
      </div>

      {hayFiltros && (
        <button
          onClick={onLimpiar}
          className="mt-3 inline-flex items-center gap-1 text-sm text-boletin-600
                     hover:underline"
        >
          <X size={14} aria-hidden="true" /> Limpiar filtros
        </button>
      )}
    </div>
  )
}
