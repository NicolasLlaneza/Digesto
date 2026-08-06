-- Índice de normas: buscador sobre los índices que la Municipalidad ya lleva
-- en planillas, una por año, con una hoja por tipo de norma.
--
-- A diferencia de `documentos`, acá no hay archivos: es puramente metadata y
-- el texto del índice. Por eso no interviene R2 ni hace falta firmar nada.

create table if not exists indice_normas (
  id          bigint generated always as identity primary key,

  tipo        text not null,      -- 'decreto' | 'resolucion'
  numero      integer not null,
  anio        smallint not null,  -- año de la norma, no del expediente
  fecha       timestamptz,

  -- El texto del índice: lo que resume qué dispone la norma. Es el campo
  -- sobre el que se busca. Ronda los 550 caracteres y llega a 2500.
  --
  -- Puede venir vacío: en las planillas hay normas sin índice cargado. Se
  -- guardan igual, porque la norma existe y tiene que aparecer al buscarla
  -- por número.
  indice      text not null default '',

  -- Expediente que originó la norma. Puede ser de un año anterior, y en los
  -- datos de origen viene incompleto en algunas filas.
  exp_tipo    text,
  exp_numero  integer,
  exp_anio    smallint,

  creado_en   timestamptz not null default now()
);

-- No se declara único (tipo, numero, anio): en los datos reales hay números
-- repetidos —rectificatorias, bis— y rechazarlos perdería normas existentes.
create index if not exists indice_normas_busqueda_num_idx
  on indice_normas (anio desc, tipo, numero);

create index if not exists indice_normas_exp_idx
  on indice_normas (exp_numero, exp_anio);

-- Búsqueda full-text en español sobre el texto del índice.
alter table indice_normas
  add column if not exists busqueda tsvector
  generated always as (to_tsvector('spanish', coalesce(indice, ''))) stored;

create index if not exists indice_normas_busqueda_idx
  on indice_normas using gin (busqueda);

-- Mismo criterio que el resto: se consulta con sesión iniciada.
alter table indice_normas enable row level security;

drop policy if exists "lectura autenticada" on indice_normas;
create policy "lectura autenticada"
  on indice_normas for select
  to authenticated
  using (true);

-- Años y tipos cargados, para poblar los filtros sin traer todas las filas.
create or replace function facetas_indice()
returns table (tipo text, anio smallint)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct n.tipo, n.anio
  from indice_normas n
  order by n.anio desc, n.tipo;
$$;

revoke all on function facetas_indice() from anon;
grant execute on function facetas_indice() to authenticated;
