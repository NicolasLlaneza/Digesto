-- Combinaciones de tipo y año presentes, para poblar los selects de filtro.
--
-- Existe como función porque el cliente solo puede pedir filas, no agregados:
-- traer los 5700+ documentos al navegador para hacer un distinct sería tirar
-- megabytes por dos listas de unos pocos elementos.

create or replace function facetas_documentos()
returns table (tipo text, anio smallint)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct d.tipo, d.anio
  from documentos d
  order by d.anio desc, d.tipo;
$$;

-- security invoker: la función corre con los permisos de quien la llama, así
-- que RLS sigue aplicando y sin sesión no devuelve nada.
revoke all on function facetas_documentos() from anon;
grant execute on function facetas_documentos() to authenticated;
