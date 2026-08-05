#!/usr/bin/env python3
"""Inserta en Supabase la metadata de los documentos ya subidos a R2.

Deduce tipo, número y año del nombre del archivo, así que conviene nombrarlos
de forma consistente. Los patrones reconocidos son, por ejemplo:

    ordenanza-1234-2019.pdf
    decreto_045_2021.pdf
    resolucion 12 2020.pdf

Lo que no matchee se salta y queda listado al final para cargarlo a mano.

    python scripts/index_docs.py ./comprimidos
    python scripts/index_docs.py ./comprimidos --prefijo ordenanzas/ --dry-run
"""

import argparse
import os
import re
import sys
import unicodedata
from pathlib import Path

from dotenv import load_dotenv
from pypdf import PdfReader

load_dotenv()

TIPOS = ("ordenanza", "decreto", "resolucion", "disposicion", "acta", "convenio")

# tipo - numero - año, con cualquier separador no alfanumérico entre medio.
PATRON = re.compile(
    rf"(?P<tipo>{'|'.join(TIPOS)})\W+(?P<numero>\d+)\W+(?P<anio>(?:19|20)\d{{2}})",
    re.IGNORECASE,
)


def normalizar(texto: str) -> str:
    """Minúsculas y sin tildes, para que 'Resolución' matchee 'resolucion'."""
    sin_tildes = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in sin_tildes if not unicodedata.combining(c)).lower()


def parsear(nombre: str):
    m = PATRON.search(normalizar(nombre))
    if not m:
        return None
    return {
        "tipo": m.group("tipo"),
        "numero": m.group("numero").lstrip("0") or "0",
        "anio": int(m.group("anio")),
    }


def extraer_texto(pdf: Path, max_paginas: int = 30) -> str:
    """Texto plano para la búsqueda full-text.

    Devuelve vacío si el PDF es un escaneo sin capa de texto; en ese caso hay
    que pasarle OCR antes (ver docs/SETUP.md).
    """
    try:
        reader = PdfReader(str(pdf))
        partes = [p.extract_text() or "" for p in reader.pages[:max_paginas]]
        return "\n".join(partes).strip()
    except Exception as e:
        print(f"    no se pudo leer el texto: {e}", file=sys.stderr)
        return ""


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("origen", type=Path)
    ap.add_argument("--prefijo", default="",
                    help="mismo prefijo que se usó en upload_r2.py")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not args.origen.is_dir():
        sys.exit(f"No existe el directorio {args.origen}")

    # El cliente se importa acá y no arriba para que --dry-run corra sin tener
    # instalado el paquete ni configuradas las credenciales.
    sb = None
    if not args.dry_run:
        url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
        if not (url and key):
            sys.exit("Faltan SUPABASE_URL y/o SUPABASE_SERVICE_KEY en .env")

        from supabase import create_client
        sb = create_client(url, key)

    filas, sin_reconocer, sin_texto = [], [], []

    for archivo in sorted(p for p in args.origen.rglob("*") if p.is_file()):
        datos = parsear(archivo.stem)
        if not datos:
            sin_reconocer.append(archivo.name)
            continue

        contenido = extraer_texto(archivo) if archivo.suffix.lower() == ".pdf" else ""
        if not contenido:
            sin_texto.append(archivo.name)

        filas.append({
            **datos,
            "titulo": f"{datos['tipo'].capitalize()} N° {datos['numero']}/{datos['anio']}",
            "r2_key": args.prefijo + archivo.relative_to(args.origen).as_posix(),
            "bytes": archivo.stat().st_size,
            "contenido": contenido or None,
        })

    print(f"  reconocidos    : {len(filas)}")
    print(f"  sin reconocer  : {len(sin_reconocer)}")
    print(f"  sin capa texto : {len(sin_texto)}  (no aparecerán en la búsqueda)")

    if args.dry_run:
        for f in filas[:10]:
            print(f"    {f['r2_key']}  ->  {f['titulo']}")
        if len(filas) > 10:
            print(f"    ... y {len(filas) - 10} más")
    elif filas:
        # upsert sobre r2_key: correr el script dos veces no duplica nada.
        for i in range(0, len(filas), 100):
            sb.table("documentos").upsert(
                filas[i:i + 100], on_conflict="r2_key"
            ).execute()
        print(f"\n  {len(filas)} documentos insertados/actualizados")

    if sin_reconocer:
        print("\n  No se pudo deducir tipo/número/año de:")
        for n in sin_reconocer[:20]:
            print(f"    {n}")
        if len(sin_reconocer) > 20:
            print(f"    ... y {len(sin_reconocer) - 20} más")


if __name__ == "__main__":
    main()
