import { Search } from 'lucide-react'

const select = 'rounded-md border border-boletin-100 bg-white px-3 py-2 text-sm'

export default function BarraFiltros({ filtros, facetas, onCambio }) {
  const set = (campo) => (e) =>
    onCambio({ ...filtros, [campo]: e.target.value, pagina: 0 })

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <div className="relative flex-1">
        <Search
          size={18}
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-boletin-600"
        />
        <input
          type="search"
          value={filtros.texto}
          onChange={set('texto')}
          placeholder="Buscar por número, título o contenido…"
          aria-label="Buscar documentos"
          className="w-full rounded-md border border-boletin-100 bg-white
                     pl-10 pr-3 py-2 text-sm"
        />
      </div>

      <select value={filtros.tipo} onChange={set('tipo')} aria-label="Tipo" className={select}>
        <option value="">Todos los tipos</option>
        {facetas.tipos.map((t) => (
          <option key={t} value={t}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </option>
        ))}
      </select>

      <select value={filtros.anio} onChange={set('anio')} aria-label="Año" className={select}>
        <option value="">Todos los años</option>
        {facetas.anios.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>
    </div>
  )
}
