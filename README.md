# Digesto Online

Consulta pública de normativa (ordenanzas, decretos, resoluciones) con buscador y filtros.

Arquitectura pensada para operar **dentro de los free tiers**: los documentos pesados
viven en Cloudflare R2 (10 GB gratis, sin cargo de egress) y Supabase guarda únicamente
la metadata, que ocupa kilobytes.

## Arquitectura

```
                 ┌──────────────────────┐
   navegador ───▶│  App React (Vite)    │
                 │  Cloudflare Pages    │
                 └──────┬──────────┬────┘
                        │          │
         metadata,      │          │   PDF / DOCX
         filtros,       │          │   (descarga directa,
         búsqueda       ▼          ▼    egress gratis)
                 ┌────────────┐  ┌──────────────┐
                 │  Supabase  │  │ Cloudflare R2│
                 │  Postgres  │  │  bucket      │
                 └────────────┘  └──────────────┘
```

Puntos clave del diseño:

- **Supabase nunca almacena archivos.** Solo la tabla `documentos` con título, tipo,
  número, fecha, tags y la *key* del objeto en R2. Con eso el uso de storage de Supabase
  queda en cero y el free tier de 1 GB nunca se toca.
- **R2 sirve los archivos con egress gratis.** Es la diferencia central contra S3 o el
  propio Supabase Storage: en un digesto público la transferencia de salida es el costo
  que se dispara, y en R2 no existe.
- **La app es de solo lectura.** No hay auth ni backend: el bundle estático consulta
  Postgres vía la API pública de Supabase con RLS en modo lectura. La carga de documentos
  se hace desde `scripts/`, offline.

## Puesta en marcha

Ver [`docs/SETUP.md`](docs/SETUP.md) para el paso a paso completo (crear el bucket,
aplicar la migración, comprimir y subir el primer lote).

Resumen:

```bash
npm install
cp .env.example .env      # completar con las credenciales
npm run dev
```

## Flujo de carga de documentos

Los tres scripts de `scripts/` están pensados para correr en ese orden:

```bash
python scripts/compress.py  ./originales ./comprimidos   # 1. reduce peso
python scripts/upload_r2.py ./comprimidos                # 2. sube a R2
python scripts/index_docs.py ./comprimidos               # 3. inserta metadata
```

El primero es el que decide si el proyecto entra o no en el free tier: los PDFs
escaneados a 300 DPI suelen bajar entre 60 % y 85 % al recomprimirse a 150 DPI, sin
pérdida de legibilidad en pantalla.
