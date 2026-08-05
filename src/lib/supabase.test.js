import { describe, it, expect, vi, beforeEach } from 'vitest'

// Se prueba la normalización con distintos valores de entorno, que es donde
// estuvo el bug: el panel ofrece varias URLs y solo una sirve.
const casos = [
  ['https://abc.supabase.co',           'https://abc.supabase.co'],
  ['https://abc.supabase.co/',          'https://abc.supabase.co'],
  ['https://abc.supabase.co/rest/v1',   'https://abc.supabase.co'],
  ['https://abc.supabase.co/rest/v1/',  'https://abc.supabase.co'],
  ['https://abc.supabase.co/auth/v1',   'https://abc.supabase.co'],
]

describe('urlBase', () => {
  beforeEach(() => vi.resetModules())

  for (const [entrada, esperado] of casos) {
    it(`${entrada} -> ${esperado}`, async () => {
      vi.stubEnv('VITE_SUPABASE_URL', entrada)
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'clave')
      const { URL_BASE } = await import('/workspace/digesto/src/lib/supabase.js')
      expect(URL_BASE).toBe(esperado)
    })
  }

  it('falla claro si la URL no es válida', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'no-es-una-url')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'clave')
    await expect(import('/workspace/digesto/src/lib/supabase.js')).rejects.toThrow(/no es una URL válida/)
  })
})
