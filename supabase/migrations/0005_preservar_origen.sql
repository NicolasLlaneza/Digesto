-- Preserva el valor original de todo campo que la importación normaliza.
--
-- La versión anterior descartaba lo que no podía interpretar: un año de
-- expediente como 202 o 7735 quedaba vacío, y un tipo de expediente que
-- traía un número se perdía. Eso convierte al importador en algo que puede
-- borrar datos, y sobre un digesto no corresponde: la planilla es la fuente
-- de verdad y acá no se descarta nada.
--
-- Ahora la normalización sigue existiendo —el buscador necesita años y
-- números para filtrar— pero conviven con el dato tal como vino.

alter table indice_normas
  add column if not exists origen jsonb not null default '{}'::jsonb;

comment on column indice_normas.origen is
  'Valores de la planilla tal como vinieron, para los campos que la '
  'importación normaliza: numero, fecha, exp_tipo, exp_numero, exp_anio. '
  'Permite auditar y recuperar cualquier dato que la normalización no haya '
  'podido interpretar.';

-- Una norma sin número interpretable tiene que entrar igual: existe en la
-- planilla, y el valor original queda en `origen` para revisarlo.
alter table indice_normas
  alter column numero drop not null;

-- Permite encontrar las filas cuya normalización no pudo con algún campo,
-- que son las que conviene revisar contra el expediente real.
create index if not exists indice_normas_origen_idx
  on indice_normas using gin (origen);
