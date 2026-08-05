# Puesta en marcha

El digesto es de acceso restringido: hay que iniciar sesión para consultarlo, y
los archivos no son alcanzables sin una sesión válida.

Todo esto entra en los free tiers. Cloudflare pide tarjeta para verificar la
cuenta de R2 pero no cobra mientras te mantengas debajo de los 10 GB.

## 1. Bucket privado en Cloudflare R2

1. Panel de Cloudflare → **R2** → *Create bucket*. Nombre: `digesto`.
2. **No habilites el acceso público.** El bucket tiene que quedar cerrado: los
   archivos se sirven con URLs firmadas que emite la Edge Function después de
   validar la sesión. Si lo abrís, cualquiera con el link lee los PDFs sin
   cuenta y el login deja de servir de algo.
3. **R2** → *Manage API tokens* → *Create API token*, permiso **Object Read &
   Write** limitado al bucket. Anotá el Access Key ID y el Secret.
4. El Account ID está arriba a la derecha en el panel de R2.

### CORS

El visor y los botones de imprimir y descargar leen el PDF por `fetch`, así que
el bucket necesita permitir tu dominio. En el bucket → **Settings** → *CORS
Policy*:

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "https://TU-DOMINIO"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

## 2. Base en Supabase

Aplicá las tres migraciones de `supabase/migrations/` en orden, desde el **SQL
Editor** del panel o con la CLI:

```bash
supabase link --project-ref TU_REF
supabase db push
```

| Migración | Qué hace |
|---|---|
| `0001_init.sql` | Tabla `documentos`, índices y búsqueda full-text |
| `0002_acceso_privado.sql` | RLS: solo lectura con sesión iniciada |
| `0003_facetas.sql` | Función que alimenta los selects de tipo y año |

De **Settings → API** sacás la URL, la `anon key` (va al frontend) y la
`service_role key` (solo para los scripts, nunca en el frontend).

## 3. Crear los usuarios

No hay registro abierto: las cuentas se crean a mano.

**Authentication → Users → Invite user**, con el correo de cada persona. Le
llega un mail para definir su contraseña.

Conviene además desactivar el alta espontánea por las dudas, en
**Authentication → Providers → Email**: apagá *Enable sign ups*.

## 4. Desplegar la Edge Function

Es la pieza que valida la sesión y firma las URLs de R2.

```bash
supabase functions deploy documento-url --no-verify-jwt

supabase secrets set \
  R2_ACCOUNT_ID=... \
  R2_ACCESS_KEY_ID=... \
  R2_SECRET_ACCESS_KEY=... \
  R2_BUCKET=digesto \
  ORIGEN_PERMITIDO=https://TU-DOMINIO
```

`ORIGEN_PERMITIDO` restringe qué sitio puede llamar a la función. En desarrollo
podés usar `http://localhost:5173`.

### Hay que desactivar la validación de JWT del gateway

Si la desplegás desde el panel, entrá a la función → **Settings** → apagá
**Enforce JWT Verification**. Con la CLI lo cubre el `--no-verify-jwt` de
arriba, y queda asentado en `supabase/config.toml`.

No es una concesión de seguridad: la función valida el JWT por su cuenta con
`supabase.auth.getUser()` y devuelve 401 antes de firmar nada. Lo que cambia es
quién valida.

Hace falta porque el navegador manda un preflight `OPTIONS` antes del POST, y
por diseño ese preflight **no lleva el header `Authorization`**. Con la
validación en el gateway, se rechaza con 401 y el navegador cancela la petición
real. El síntoma es un error de CORS que no menciona el JWT por ningún lado:

```
Response to preflight request doesn't pass access control check:
It does not have HTTP ok status.
```

## 5. Variables de entorno del frontend

```bash
cp .env.example .env
```

Solo necesita `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. La dirección del
bucket ya no va acá: el frontend nunca la conoce.

## 6. Cargar los documentos

Los scripts corren en orden. Necesitan sus paquetes:

```bash
pip install -r scripts/requirements.txt
```

### 6.1 ¿Comprimir?

Medí antes de decidir. `compress.py` no usa dependencias de pip —solo
biblioteca estándar— y con `--muestra` estima el ahorro sin procesar todo:

```bash
python scripts/compress.py ./originales --muestra 40
```

Si el ahorro es bajo (por debajo de ~20 %), no vale la pena: son PDFs ya
eficientes y comprimirlos agrega complejidad sin ganancia. Si es alto, la
corrida real es:

```bash
python scripts/compress.py ./originales ./comprimidos
```

Necesita **Ghostscript** o **PyMuPDF**, lo que tengas:

```bash
apt install ghostscript              # o brew install ghostscript
pip install --user pymupdf pillow    # alternativa sin permisos de admin
```

### 6.2 Subir a R2

```bash
python scripts/upload_r2.py ./originales
```

Es idempotente: saltea lo que ya está con el mismo tamaño, así que podés
cortarlo y retomarlo, y volver a correrlo cada mes para las altas nuevas.

### 6.3 Indexar la metadata

```bash
python scripts/index_docs.py ./originales --dry-run
python scripts/index_docs.py ./originales
```

Deduce tipo, número y año del nombre del archivo. Reconoce la palabra completa
y las abreviaturas habituales, con cualquier separador:

```
DEC-1127-2025.pdf        decreto_045_2021.pdf
RESO-304-2025.pdf        ordenanza-1234-2019.pdf
ORD 88 2024.pdf          resolución 12 2020.pdf
DISP-7-2023.pdf          CONV-15-2021.pdf
```

Hace upsert sobre `r2_key`, así que correrlo dos veces no duplica nada.

## 7. Levantar la app

```bash
npm install
npm run dev
```

## 8. Deploy en Cloudflare Pages

1. **Workers & Pages** → *Create* → *Pages* → conectá el repo.
2. Build command: `npm run build` · Output directory: `dist`
3. Cargá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en *Settings →
   Environment variables*.
4. Acordate de agregar el dominio final a la política de CORS del bucket y a
   `ORIGEN_PERMITIDO`.

---

## OCR: que los escaneos aparezcan en la búsqueda por contenido

Un PDF escaneado es una imagen: no tiene texto que Postgres pueda indexar, así
que el filtro por contenido no lo va a encontrar (sí la búsqueda por número).
`index_docs.py` informa cuántos documentos quedaron sin capa de texto.

Para agregársela, antes de subir:

```bash
pip install ocrmypdf
find ./originales -name '*.pdf' -print0 | \
  xargs -0 -P 4 -I{} ocrmypdf --language spa --skip-text {} {}
```

`--skip-text` deja intactos los que ya tienen texto, así que es seguro pasarlo
sobre todo el árbol.
