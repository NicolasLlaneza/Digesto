import { useAuth } from '../lib/auth'
import Login from '../pages/Login'

export default function RutaProtegida({ children }) {
  const { sesion, cargando } = useAuth()

  // Mientras se lee la sesión guardada no se sabe todavía si hay usuario:
  // mostrar el login acá haría parpadear la pantalla en cada recarga.
  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-boletin-600">
        Cargando…
      </div>
    )
  }

  return sesion ? children : <Login />
}
