import { describe, it, expect, vi } from 'vitest'

vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'clave')

const { tramosResaltados, etiquetaTipo } = await import('./indice.js')

describe('tramosResaltados', () => {
  it('separa las coincidencias del texto que las rodea', () => {
    expect(tramosResaltados('Reale «Multa» y «Plazo» hoy')).toEqual([
      { clave: 0, coincide: false, texto: 'Reale ' },
      { clave: 1, coincide: true,  texto: 'Multa' },
      { clave: 2, coincide: false, texto: ' y ' },
      { clave: 3, coincide: true,  texto: 'Plazo' },
      { clave: 4, coincide: false, texto: ' hoy' },
    ])
  })

  it('devuelve un solo tramo cuando no hubo coincidencias', () => {
    const r = tramosResaltados('texto sin marcas')
    expect(r).toHaveLength(1)
    expect(r[0].coincide).toBe(false)
  })

  it('no rompe con texto vacío o ausente', () => {
    expect(tramosResaltados('')).toEqual([])
    expect(tramosResaltados(null)).toEqual([])
  })

  it('no interpreta marcado como HTML', () => {
    const r = tramosResaltados('«<script>» normal')
    expect(r[0]).toEqual({ clave: 0, coincide: true, texto: '<script>' })
  })
})

describe('etiquetaTipo', () => {
  it('distingue las resoluciones de personal de las generales', () => {
    expect(etiquetaTipo('resolucion')).toBe('Resolución')
    expect(etiquetaTipo('resolucion_personal')).toBe('Resolución de Personal')
  })

  it('devuelve el valor crudo si el tipo es desconocido', () => {
    expect(etiquetaTipo('convenio')).toBe('convenio')
  })
})
