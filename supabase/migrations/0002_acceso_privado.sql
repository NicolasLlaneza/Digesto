-- El digesto pasa a ser privado: se accede solo con sesión iniciada.
--
-- Las altas de usuarios se hacen desde el panel de Supabase (Authentication →
-- Users → Invite). No hay registro abierto, así que no hace falta ni tabla de
-- perfiles ni roles: todo usuario con sesión es un lector.

drop policy if exists "lectura publica" on documentos;

create policy "lectura autenticada"
  on documentos for select
  to authenticated
  using (true);

-- Sin política para el rol anon, la tabla queda invisible sin sesión: con RLS
-- activo, lo que no está explícitamente permitido está denegado.
