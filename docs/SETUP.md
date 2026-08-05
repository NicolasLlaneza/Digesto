# Puesta en marcha

Todo lo que sigue se hace dentro de free tiers. No hace falta tarjeta en ningún paso
salvo en R2, donde Cloudflare la pide para verificar la cuenta pero no cobra mientras
te mantengas debajo de los 10 GB.

## 1. Bucket en Cloudflare R2

1. Panel de Cloudflare → **R2** → *Create bucket*. Nombre: `digesto`. Región: *Automatic*.
2. En el bucket → **Settings** → *Public access*: habilitá el dominio `r2.dev`.
   Te da una URL tipo `https://pub-xxxxxxxx.r2.dev` — esa va en `VITE_R2_PUBLIC_URL`.
   Para producción conviene conectar un dominio propio desde esa misma pantalla.
3. **R2** → *Manage API tokens* → *Create API token*, permiso **Object Read & Write**
   limitado al bucket `digesto`. Anotá el Access Key ID y el Secret.
4. El Account ID está arriba a la derecha en el panel de R2.

### CORS

Para que el visor de PDF embebido funcione, el bucket necesita permitir tu dominio.
En el bucket → **Settings** → *CORS Policy*:

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

Podés usar un proyecto nuevo o el que ya tenés: la tabla ocupa kilobytes y no toca
el límite de storage, porque acá no se guarda ningún archivo.

Aplicá la migración desde el **SQL Editor** del panel, pegando el contenido de
`supabase/migrations/0001_init.sql`. O con la CLI:

```bash
supabase link --project-ref TU_REF
supabase db push
```

De **Settings → API** sacás la URL, la `anon key` (va al frontend) y la
`service_role key` (solo para los scripts, nunca en el frontend).

## 3. Variables de entorno

```bash
cp .env.example .env
```

Completá los valores de los dos pasos anteriores.

## 4. Cargar los documentos

Los tres scripts corren en orden.

`compress.py` acepta dos motores de compresión y usa el que encuentre. Con
cualquiera de los dos alcanza:

**Ghostscript** — mejor resultado, pero en Windows el instalador pide permisos de
administrador:

```bash
apt install ghostscript        # Linux
brew install ghostscript       # macOS
# Windows: https://ghostscript.com/releases/gsdnld.html
```

Si es una instalación portable y no está en el PATH, pasale la ruta:

```bash
python scripts/compress.py ORIGEN --muestra 20 --gs C:\ruta\a\gswin64c.exe
```

**PyMuPDF** — comprime un poco menos, pero se instala solo con pip y sin permisos
de administrador, así que es la salida en una máquina restringida:

```bash
pip install --user pymupdf pillow
```

Con `--motor ghostscript` o `--motor pymupdf` forzás uno u otro.

Los otros dos scripts sí necesitan sus paquetes, pero recién cuando vayas a subir:

```bash
pip install -r scripts/requirements.txt
```

### 4.1 Comprimir

Antes de subir nada, medí cuánto podés bajar. El modo `--muestra` comprime unos
pocos archivos repartidos por todo el árbol y extrapola, así tenés el número en un
minuto en vez de esperar a que procese el corpus entero:

```bash
python scripts/compress.py ./originales --muestra 20
```

Cuando el resultado te cierre, la corrida real:

```bash
python scripts/compress.py ./originales ./comprimidos
```

El script espeja la estructura de carpetas, comprime los PDFs a 150 DPI y **conserva
el original cuando la compresión no gana nada** (los PDFs nativos de texto a veces
crecen al recomprimirse). Al final te dice qué porcentaje del free tier de R2 vas a
usar.

Si necesitás más agresividad para el archivo histórico:

```bash
python scripts/compress.py ./originales ./comprimidos --perfil screen --dpi 100
```

### 4.2 Subir a R2

```bash
python scripts/upload_r2.py ./comprimidos
```

Es idempotente: los objetos que ya están con el mismo tamaño se saltan, así que
podés cortarlo y retomarlo sin re-subir todo.

### 4.3 Indexar la metadata

```bash
python scripts/index_docs.py ./comprimidos --dry-run
python scripts/index_docs.py ./comprimidos
```

Deduce tipo, número y año del nombre del archivo. Corré primero el `--dry-run` para
ver cuántos reconoce; los que no matcheen quedan listados al final.

Reconoce la palabra completa y las abreviaturas habituales, con cualquier
separador entre las partes:

```
DEC-1127-2025.pdf        decreto_045_2021.pdf
RESO-304-2025.pdf        ordenanza-1234-2019.pdf
ORD 88 2024.pdf          resolución 12 2020.pdf
DISP-7-2023.pdf          CONV-15-2021.pdf
```

## 5. Levantar la app

```bash
npm install
npm run dev
```

## 6. Deploy en Cloudflare Pages

Pages tiene ancho de banda ilimitado en el plan free, así que el deploy tampoco cuesta.

1. Panel de Cloudflare → **Workers & Pages** → *Create* → *Pages* → conectá el repo.
2. Build command: `npm run build` · Output directory: `dist`
3. Cargá las tres variables `VITE_*` en *Settings → Environment variables*.

---

## OCR: que los escaneos aparezcan en la búsqueda

Un PDF escaneado es una imagen: no tiene texto que Postgres pueda indexar.
`index_docs.py` te avisa cuántos documentos quedaron "sin capa texto".

Para agregarles esa capa, antes de comprimir:

```bash
pip install ocrmypdf
ocrmypdf --language spa --skip-text entrada.pdf salida.pdf
```

En lote:

```bash
find ./originales -name '*.pdf' -print0 | \
  xargs -0 -P 4 -I{} ocrmypdf --language spa --skip-text {} {}
```

`--skip-text` deja intactos los PDFs que ya tienen texto, así que es seguro pasarlo
sobre todo el árbol. Corré el OCR **antes** de `compress.py`.
