-- Evita que una importación repetida duplique normas.
--
-- Importar dos veces el mismo año dejaba las normas por duplicado, porque la
-- carga suma y no reemplaza. Pasó con 2023.
--
-- La comparación va por el contenido completo y no por (tipo, numero, anio):
-- medido sobre las 81.866 normas cargadas, esa combinación rechazaría 1.978
-- filas legítimas —hay números repetidos reales— y agregarle la fecha
-- rechazaría 52. Por contenido completo el rechazo es cero: acepta todo lo
-- que ya está y solo frena lo que es idéntico.

-- La huella va sobre md5 y no sobre las columnas directamente porque `indice`
-- llega a 2562 caracteres, por encima de lo que admite una entrada de índice
-- btree.
--
-- La fecha se reduce a segundos con `extract`, y no con `to_char`, porque una
-- columna generada exige expresiones inmutables y el formateo depende de la
-- configuración de la sesión. El desplazamiento fijo evita además que la
-- huella cambie si cambia la zona horaria del servidor.
alter table indice_normas
  add column if not exists huella text
  generated always as (
    md5(
      tipo || '|' ||
      coalesce(numero::text, '') || '|' ||
      anio::text || '|' ||
      coalesce(extract(epoch from (fecha at time zone interval '0'))::text, '') || '|' ||
      coalesce(indice, '') || '|' ||
      coalesce(exp_tipo, '') || '|' ||
      coalesce(exp_numero::text, '') || '|' ||
      coalesce(exp_anio::text, '')
    )
  ) stored;

create unique index if not exists indice_normas_huella_idx
  on indice_normas (huella);

-- Saltear en lugar de rechazar: la planilla del año en curso se reimporta
-- cada mes con las normas nuevas agregadas al final. Con la restricción a
-- secas, esa carga fallaría entera por las filas ya presentes; así entra
-- solo lo que todavía no está.
create or replace function omitir_norma_repetida()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1 from indice_normas d
    where d.huella = md5(
      new.tipo || '|' ||
      coalesce(new.numero::text, '') || '|' ||
      new.anio::text || '|' ||
      coalesce(extract(epoch from (new.fecha at time zone interval '0'))::text, '') || '|' ||
      coalesce(new.indice, '') || '|' ||
      coalesce(new.exp_tipo, '') || '|' ||
      coalesce(new.exp_numero::text, '') || '|' ||
      coalesce(new.exp_anio::text, '')
    )
  ) then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists omitir_repetidas on indice_normas;
create trigger omitir_repetidas
  before insert on indice_normas
  for each row execute function omitir_norma_repetida();
