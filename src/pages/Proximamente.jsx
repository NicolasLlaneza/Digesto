import { Link } from 'react-router-dom'
import { Scale } from 'lucide-react'

export default function Proximamente() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <Scale size={40} aria-hidden="true" className="text-boletin-600" />

      <h1 className="mt-6 text-3xl font-semibold tracking-tight">
        Digesto Online
      </h1>

      <p className="mt-3 text-lg text-boletin-600">Próximamente</p>

      <p className="mt-6 max-w-md text-sm text-boletin-600">
        Estamos preparando la consulta digital de normativa. En breve vas a
        poder buscar ordenanzas, decretos y resoluciones desde acá.
      </p>

      {/* El digesto sigue disponible para quien tenga cuenta: la portada lo
          oculta del público, no lo da de baja. */}
      <Link
        to="/buscador"
        className="mt-10 text-xs text-boletin-600/70 hover:text-boletin-600 hover:underline"
      >
        Acceso interno
      </Link>
    </div>
  )
}
