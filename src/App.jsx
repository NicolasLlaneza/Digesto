import { Routes, Route, Link } from 'react-router-dom'
import { Scale } from 'lucide-react'
import Home from './pages/Home'
import DocumentoDetalle from './pages/DocumentoDetalle'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-boletin-900 text-white">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center gap-3">
          <Scale size={26} aria-hidden="true" />
          <Link to="/" className="text-xl font-semibold tracking-tight">
            Digesto Online
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/documento/:id" element={<DocumentoDetalle />} />
        </Routes>
      </main>

      <footer className="border-t border-boletin-100 py-6 text-center text-sm text-boletin-600">
        Consulta pública de normativa
      </footer>
    </div>
  )
}
