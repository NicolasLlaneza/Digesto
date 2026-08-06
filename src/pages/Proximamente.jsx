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

      {/* La portada solo esconde el contenido del público. Quien tenga cuenta
          entra por acá; sin sesión, este enlace lleva al login. */}
      <Link
        to="/buscador"
        className="mt-10 rounded-md border border-boletin-100 bg-white px-4 py-2
                   text-sm text-boletin-600 hover:bg-boletin-50"
      >
        Acceso interno
      </Link>
    </div>
  )
}
