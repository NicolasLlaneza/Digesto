import { Routes, Route, Link } from 'react-router-dom'
import { Scale, LogOut } from 'lucide-react'
import { useAuth } from './lib/auth'
import RutaProtegida from './components/RutaProtegida'
import Home from './pages/Home'
import DocumentoDetalle from './pages/DocumentoDetalle'

function Cabecera() {
  const { usuario, salir } = useAuth()

  return (
    <header className="bg-boletin-900 text-white">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
        <Scale size={24} aria-hidden="true" />
        <Link to="/" className="text-lg font-semibold tracking-tight">
          Digesto Online
        </Link>

        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden sm:inline text-white/70">{usuario?.email}</span>
          <button
            onClick={salir}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1
                       hover:bg-white/10"
          >
            <LogOut size={16} aria-hidden="true" />
            Salir
          </button>
        </div>
      </div>
    </header>
  )
}

export default function App() {
  return (
    <RutaProtegida>
      <div className="min-h-screen flex flex-col">
        <Cabecera />

        <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/documento/:id" element={<DocumentoDetalle />} />
          </Routes>
        </main>

        <footer className="border-t border-boletin-100 py-6 text-center text-sm
                           text-boletin-600">
          Consulta interna de normativa
        </footer>
      </div>
    </RutaProtegida>
  )
}
