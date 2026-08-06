import { Routes, Route, Link, NavLink } from 'react-router-dom'
import { Scale, LogOut, Search, FileText } from 'lucide-react'
import { useAuth } from './lib/auth'
import RutaProtegida from './components/RutaProtegida'
import Proximamente from './pages/Proximamente'
import Indice from './pages/Indice'
import Home from './pages/Home'
import DocumentoDetalle from './pages/DocumentoDetalle'

const SECCIONES = [
  { a: '/buscador', icono: Search, texto: 'Índice de normas' },
  { a: '/digesto', icono: FileText, texto: 'Documentos' },
]

function Cabecera() {
  const { usuario, salir } = useAuth()

  const enlace = ({ isActive }) =>
    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm ' +
    (isActive ? 'bg-white/15 font-medium' : 'text-white/75 hover:bg-white/10')

  return (
    <header className="bg-boletin-900 text-white">
      <div className="max-w-5xl mx-auto px-4 pt-4 pb-2 flex items-center gap-3">
        <Scale size={24} aria-hidden="true" />
        <Link to="/buscador" className="text-lg font-semibold tracking-tight">
          Digesto Municipal
        </Link>

        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden sm:inline text-white/70">{usuario?.email}</span>
          <button
            onClick={salir}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-white/10"
          >
            <LogOut size={16} aria-hidden="true" />
            Salir
          </button>
        </div>
      </div>

      <nav className="max-w-5xl mx-auto px-4 pb-2 flex gap-1">
        {SECCIONES.map(({ a, icono: Icono, texto }) => (
          <NavLink key={a} to={a} className={enlace}>
            <Icono size={15} aria-hidden="true" />
            {texto}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}

/** Layout del área privada. */
function Privado({ children }) {
  return (
    <RutaProtegida>
      <div className="min-h-screen flex flex-col">
        <Cabecera />

        <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
          {children}
        </main>

        <footer className="border-t border-boletin-100 py-6 text-center text-sm
                           text-boletin-600">
          Consulta interna de normativa
        </footer>
      </div>
    </RutaProtegida>
  )
}

export default function App() {
  return (
    <Routes>
      {/* La portada es pública y no revela nada del contenido. */}
      <Route path="/" element={<Proximamente />} />

      {/* Buscador del índice: es el foco actual del proyecto. */}
      <Route path="/buscador" element={<Privado><Indice /></Privado>} />

      {/* Consulta de documentos: funciona, pero todavía sin carga masiva. */}
      <Route path="/digesto" element={<Privado><Home /></Privado>} />
      <Route
        path="/digesto/documento/:id"
        element={<Privado><DocumentoDetalle /></Privado>}
      />
    </Routes>
  )
}
