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

// ORIGEN_PERMITIDO admite varios orígenes separados por coma, para que
// desarrollo y producción convivan sin tener que editar el secret.
//
// Se normaliza cada uno a su origen: el navegador compara el header contra el
// origen del documento carácter por carácter, así que una barra final de más
// —o una ruta pegada— rompe el CORS con un mensaje que no deja claro que el
// problema es un solo carácter.
function permitidos(): string[] {
  return (Deno.env.get("ORIGEN_PERMITIDO") ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
    .map((o) => {
      try {
        return new URL(o).origin;
      } catch {
        return o.replace(/\/+$/, "");
      }
    });
}

function cabecerasCors(req: Request) {
  const lista = permitidos();
  const origen = req.headers.get("Origin");

  // Se devuelve el origen que pidió, si está autorizado. Con varios orígenes
  // configurados no se puede mandar la lista entera: el header admite uno solo.
  const permitido = lista.length === 0
    ? "*"
    : (origen && lista.includes(origen) ? origen : lista[0]);

  return {
    "Access-Control-Allow-Origin": permitido,
    // apikey y x-client-info los agrega el cliente de Supabase por su cuenta,
    // así que tienen que estar permitidos aunque este código no los use.
    "Access-Control-Allow-Headers":
      "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "3600",
    // El header depende del Origin entrante, así que las caches no deben
    // reutilizar una respuesta entre orígenes distintos.
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cabecerasCors(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cabecerasCors(req) });
  }
  if (req.method !== "POST") {
    return json({ error: "Método no permitido" }, 405, req);
  }

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Falta la sesión" }, 401, req);

  // El cliente se crea con la anon key y el token del usuario, así que
  // getUser() valida la firma del JWT contra el proyecto.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );

  const { data: { user }, error: errorAuth } = await supabase.auth.getUser();
  if (errorAuth || !user) return json({ error: "Sesión inválida" }, 401, req);

  let id: unknown;
  let descarga = false;
  try {
    const cuerpo = await req.json();
    id = cuerpo.id;
    descarga = cuerpo.descarga === true;
  } catch {
    return json({ error: "Cuerpo inválido" }, 400, req);
  }
  if (typeof id !== "number" && typeof id !== "string") {
    return json({ error: "Falta el id del documento" }, 400, req);
  }

  // Se busca la key en la tabla en vez de aceptarla del cliente: si no, el
  // endpoint firmaría cualquier ruta arbitraria del bucket.
  const { data: doc, error: errorDoc } = await supabase
    .from("documentos")
    .select("r2_key, titulo")
    .eq("id", id)
    .single();

  if (errorDoc || !doc) return json({ error: "Documento no encontrado" }, 404, req);

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

  // Con este parámetro es R2 quien manda Content-Disposition, así que el
  // navegador baja el archivo con solo navegar a la URL. Sin fetch de por
  // medio no hay CORS que pueda romper la descarga, y no se duplica el
  // archivo en memoria. Va antes de firmar porque forma parte de la firma.
  if (descarga) {
    // Se limita a caracteres seguros: el header es ASCII, y unas comillas o
    // un salto de línea en el nombre lo partirían.
    const nombre = String(doc.titulo)
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\w .-]/g, "_")
      .slice(0, 100);
    destino.searchParams.set(
      "response-content-disposition",
      `attachment; filename="${nombre}.pdf"`,
    );
  }

  const firmada = await aws.sign(destino.toString(), {
    method: "GET",
    aws: { signQuery: true },
  });

  return json({
    url: firmada.url,
    titulo: doc.titulo,
    expira_en: VALIDEZ_SEGUNDOS,
  }, 200, req);
});
