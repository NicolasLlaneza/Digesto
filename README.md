# Digesto Online

Consulta interna de normativa (decretos, resoluciones, ordenanzas) con acceso
restringido por usuario.

Arquitectura pensada para operar **dentro de los free tiers**: los documentos
viven en Cloudflare R2 y Supabase guarda únicamente la metadata, que ocupa
kilobytes.

## Arquitectura

```
                 ┌──────────────────────┐
   navegador ───▶│  App React (Vite)    │
                 │  Cloudflare Pages    │
                 └──┬─────────┬─────────┘
                    │         │
      login,        │         │  1. pide URL firmada
      metadata,     │         ▼
      búsqueda      │   ┌──────────────────┐
                    │   │  Edge Function   │──┐ valida la sesión
                    ▼   │  documento-url   │  │ y firma contra R2
              ┌────────────┐──────────────┘   │
              │  Supabase  │◀─────────────────┘
              │  Auth + PG │
              └────────────┘

                             2. descarga directa
   navegador ─────────────────────────────────▶ ┌──────────────┐
                                                │ R2 (privado) │
                                                └──────────────┘
```

Puntos clave del diseño:

- **Supabase nunca almacena archivos.** Solo la tabla `documentos` con tipo,
  número, año, texto para búsqueda y la *key* del objeto en R2. El uso de
  storage queda en cero y el límite de 1 GB del free tier nunca se toca.
- **El bucket de R2 es privado.** Los archivos se sirven con URLs firmadas de
  cinco minutos que emite una Edge Function tras validar el JWT. Proteger solo
  el frontend no alcanzaría: los PDFs seguirían siendo accesibles por URL
  directa.
- **R2 no cobra egress**, que es la diferencia central contra S3 o el propio
  Supabase Storage cuando los documentos se descargan seguido.
- **No hay registro abierto.** Las cuentas se crean desde el panel de Supabase.

## Funcionalidad

- Búsqueda por número de decreto o resolución, sobre todos los años cargados
- Filtro por contenido (full-text en español sobre el texto de las normas)
- Filtros por tipo y año
- Visor de PDF embebido, con impresión y descarga

## Puesta en marcha

Ver [`docs/SETUP.md`](docs/SETUP.md) para el paso a paso completo.

```bash
npm install
cp .env.example .env      # completar con las credenciales
npm run dev
```

## Flujo de carga de documentos

```bash
python scripts/compress.py  ./originales --muestra 40   # 1. ¿conviene comprimir?
python scripts/upload_r2.py ./originales                # 2. sube a R2
python scripts/index_docs.py ./originales               # 3. inserta metadata
```

Los dos últimos son idempotentes, así que para las altas mensuales alcanza con
volver a correrlos sobre la carpeta completa: solo procesan lo nuevo.
