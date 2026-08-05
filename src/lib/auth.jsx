import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const Contexto = createContext(null)

export function ProveedorAuth({ children }) {
  const [sesion, setSesion] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    // La sesión guardada se lee de forma asíncrona, así que hasta que
    // resuelva no se sabe si el usuario está logueado o no. Sin este estado
    // intermedio, las rutas protegidas rebotarían al login en cada recarga.
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session)
      setCargando(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, nueva) => {
      setSesion(nueva)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const valor = {
    sesion,
    usuario: sesion?.user ?? null,
    cargando,
    ingresar: (email, password) =>
      supabase.auth.signInWithPassword({ email, password }),
    salir: () => supabase.auth.signOut(),
  }

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useAuth() {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useAuth debe usarse dentro de ProveedorAuth')
  return ctx
}
