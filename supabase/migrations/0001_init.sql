-- Digesto: esquema inicial.
--
-- La tabla guarda metadata y la key del objeto en R2, nunca el archivo.
-- Un digesto de decenas de miles de normas ocupa acá unos pocos MB.

create table if not exists documentos (
  id            bigint generated always as identity primary key,

  tipo          text not null,           -- 'ordenanza' | 'decreto' | 'resolucion' | ...
  numero        text not null,
  anio          smallint not null,
  fecha_sancion date,

  titulo        text not null,
  sumario       text,                    -- resumen corto, se muestra en el listado
  tags          text[] not null default '{}',

  -- Ubicación del archivo dentro del bucket de R2. La Edge Function la lee de
  -- acá para firmar la URL de descarga.
  r2_key        text not null unique,
  mime          text not null default 'application/pdf',
  bytes         bigint,

  -- Texto plano para búsqueda. Se llena con OCR si el PDF es escaneado.
  contenido     text,

  vigente       boolean not null default true,
  creado_en     timestamptz not null default now()
);

create index if not exists documentos_anio_idx  on documentos (anio desc, numero);
create index if not exists documentos_tipo_idx  on documentos (tipo);
create index if not exists documentos_tags_idx  on documentos using gin (tags);

-- Búsqueda full-text en español sobre título, sumario y contenido.
alter table documentos
  add column if not exists busqueda tsvector
  generated always as (
    to_tsvector(
      'spanish',
      coalesce(titulo, '') || ' ' ||
      coalesce(sumario, '') || ' ' ||
      coalesce(contenido, '')
    )
  ) stored;

create index if not exists documentos_busqueda_idx on documentos using gin (busqueda);

-- RLS activo y sin políticas: por defecto queda todo denegado. Las de lectura
-- las define 0002_acceso_privado.sql.
--
-- La escritura no tiene política en ningún momento: la carga corre con la
-- service_role key desde scripts/index_docs.py, que salta RLS.
alter table documentos enable row level security;
