import { useState } from 'react'
import { Scale, LogIn } from 'lucide-react'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { ingresar } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setEnviando(true)
    setError(null)

    const { error } = await ingresar(email, password)
    if (error) {
      // El mensaje de Supabase viene en inglés y distingue entre usuario
      // inexistente y contraseña incorrecta, lo que ayuda a enumerar cuentas.
      setError('Usuario o contraseña incorrectos.')
      setEnviando(false)
    }
    // Con éxito no se toca el estado: el cambio de sesión desmonta este
    // componente y React avisaría de un set sobre algo ya desmontado.
  }

  const campo = 'w-full rounded-md border border-boletin-100 px-3 py-2 text-sm'

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white rounded-lg border border-boletin-100 p-6"
      >
        <div className="flex items-center gap-2 mb-1">
          <Scale size={24} aria-hidden="true" />
          <h1 className="text-xl font-semibold">Digesto Online</h1>
        </div>
        <p className="text-sm text-boletin-600 mb-6">
          Acceso restringido. Ingresá con tu cuenta.
        </p>

        <label className="block text-sm font-medium mb-1" htmlFor="email">
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`${campo} mb-4`}
        />

        <label className="block text-sm font-medium mb-1" htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`${campo} mb-4`}
        />

        {error && (
          <p role="alert" className="mb-4 text-sm text-red-800">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md
                     bg-boletin-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          <LogIn size={16} aria-hidden="true" />
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
