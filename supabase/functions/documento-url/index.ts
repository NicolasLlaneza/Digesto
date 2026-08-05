// Devuelve una URL firmada y de vida corta para descargar un documento de R2.
//
// Existe porque el bucket es privado: sin esto, proteger la app con login no
// serviría de nada, ya que los PDFs seguirían siendo accesibles por URL
// directa a quien la tuviera.
//
// Flujo: valida el JWT de Supabase -> confirma que el documento existe en la
// tabla -> firma una URL de S3 contra R2 -> la devuelve.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

// Suficiente para abrir o descargar el archivo, corto para que un link
// filtrado deje de servir enseguida.
const VALIDEZ_SEGUNDOS = 300;

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ORIGEN_PERMITIDO") ?? "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Falta la sesión" }, 401);

  // El cliente se crea con la anon key y el token del usuario, así que
  // getUser() valida la firma del JWT contra el proyecto.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );

  const { data: { user }, error: errorAuth } = await supabase.auth.getUser();
  if (errorAuth || !user) return json({ error: "Sesión inválida" }, 401);

  let id: unknown;
  try {
    ({ id } = await req.json());
  } catch {
    return json({ error: "Cuerpo inválido" }, 400);
  }
  if (typeof id !== "number" && typeof id !== "string") {
    return json({ error: "Falta el id del documento" }, 400);
  }

  // Se busca la key en la tabla en vez de aceptarla del cliente: si no, el
  // endpoint firmaría cualquier ruta arbitraria del bucket.
  const { data: doc, error: errorDoc } = await supabase
    .from("documentos")
    .select("r2_key, titulo")
    .eq("id", id)
    .single();

  if (errorDoc || !doc) return json({ error: "Documento no encontrado" }, 404);

  const cuenta = Deno.env.get("R2_ACCOUNT_ID")!;
  const bucket = Deno.env.get("R2_BUCKET")!;

  const aws = new AwsClient({
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
    service: "s3",
    region: "auto",
  });

  const destino = new URL(
    `https://${cuenta}.r2.cloudflarestorage.com/${bucket}/` +
      doc.r2_key.split("/").map(encodeURIComponent).join("/"),
  );
  destino.searchParams.set("X-Amz-Expires", String(VALIDEZ_SEGUNDOS));

  const firmada = await aws.sign(destino.toString(), {
    method: "GET",
    aws: { signQuery: true },
  });

  return json({
    url: firmada.url,
    titulo: doc.titulo,
    expira_en: VALIDEZ_SEGUNDOS,
  });
});
