-- Buscador del índice: relevancia, resaltado y conteo eficiente.
--
-- Con 84 mil normas cargadas, la consulta que armaba el frontend tardaba
-- medio segundo en la primera pantalla —la que ve todo el mundo al entrar—
-- porque contar el total obligaba a recorrer la tabla entera. Se reemplaza
-- por una función que hace las tres cosas en una sola ida a la base.

-- Un índice sin texto es legítimo: la norma existe aunque la planilla no
-- traiga el asunto. Además, al importar por CSV una celda vacía llega como
-- nulo y la restricción rechazaba el archivo completo, no solo esa fila.
alter table indice_normas alter column indice drop not null;

-- Orden por defecto del listado. Sin este índice, devolver 25 filas exige
-- ordenar las 84 mil.
create index if not exists indice_normas_orden_idx
  on indice_normas (anio desc, numero desc);

create or replace function buscar_indice(
  q            text     default null,
  p_numero     integer  default null,
  p_expediente integer  default null,
  p_tipo       text     default null,
  p_anio       integer  default null,
  p_limite     integer  default 25,
  p_offset     integer  default 0
)
returns table (
  id bigint, tipo text, numero integer, anio smallint, fecha timestamptz,
  indice text, resaltado text,
  exp_tipo text, exp_numero integer, exp_anio smallint,
  total bigint
)
language sql stable security invoker set search_path = public as $$
  with consulta as (
    select case when coalesce(trim(q), '') = '' then null
                else websearch_to_tsquery('spanish', q) end as ts
  ),
  filtrado as (
    select n.id, n.busqueda
    from indice_normas n, consulta c
    where (c.ts is null or n.busqueda @@ c.ts)
      and (p_numero     is null or n.numero     = p_numero)
      and (p_expediente is null or n.exp_numero = p_expediente)
      and (p_tipo       is null or n.tipo       = p_tipo)
      and (p_anio       is null or n.anio       = p_anio)
  ),
  -- El total va como agregado aparte y no como ventana sobre la página: con
  -- count(*) over () el plan tiene que materializar todo el resultado, y sin
  -- filtros eso son las 84 mil filas.
  cuenta as (
    -- Sin filtros el total es el de la tabla entera, que Postgres resuelve
    -- con un recorrido de índice en milisegundos. Pasarlo por `filtrado`
    -- obligaría a materializar las 84 mil filas para contarlas.
    -- El total solo se calcula al pedir la primera página: no cambia
    -- mientras se pagina, y el frontend lo conserva. Así el costo de contar
    -- se paga una vez por búsqueda y no una vez por página.
    select case
      when p_offset > 0 then null
      when (select ts from consulta) is null and p_numero is null
           and p_expediente is null and p_tipo is null and p_anio is null
      then (select count(*) from indice_normas)
      else (select count(*) from filtrado)
    end as total
  ),
  -- Las condiciones se repiten en lugar de reusar `filtrado`: pasando por
  -- el CTE el planificador no puede empujar el LIMIT hasta el índice, y
  -- termina ordenando el resultado completo para devolver 25 filas.
  pagina as (
    select n.*
    from indice_normas n, consulta c
    where (c.ts is null or n.busqueda @@ c.ts)
      and (p_numero     is null or n.numero     = p_numero)
      and (p_expediente is null or n.exp_numero = p_expediente)
      and (p_tipo       is null or n.tipo       = p_tipo)
      and (p_anio       is null or n.anio       = p_anio)
    order by
      case when c.ts is null then null
           else ts_rank_cd(n.busqueda, c.ts) end desc nulls last,
      n.anio desc, n.numero desc
    limit p_limite offset p_offset
  )
  select p.id, p.tipo, p.numero, p.anio, p.fecha, p.indice,
         case when c.ts is null then null
              else ts_headline('spanish', p.indice, c.ts,
                     'StartSel=«,StopSel=»,MaxWords=45,MinWords=25,MaxFragments=2,FragmentDelimiter= … ')
         end,
         p.exp_tipo, p.exp_numero, p.exp_anio, k.total
  from pagina p, consulta c, cuenta k;
$$;

revoke all on function buscar_indice(text, integer, integer, text, integer, integer, integer) from anon;
grant execute on function buscar_indice(text, integer, integer, text, integer, integer, integer) to authenticated;
