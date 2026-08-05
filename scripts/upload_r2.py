#!/usr/bin/env python3
"""Sube los documentos comprimidos al bucket de Cloudflare R2.

R2 habla el protocolo de S3, así que alcanza con boto3 apuntado al endpoint
de la cuenta. La key de cada objeto espeja la ruta relativa dentro de ORIGEN,
que es la misma que después indexa index_docs.py.

    python scripts/upload_r2.py ./comprimidos
    python scripts/upload_r2.py ./comprimidos --prefijo ordenanzas/
"""

import argparse
import mimetypes
import os
import sys
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

# Un año de cache: los documentos de un digesto no cambian una vez publicados.
CACHE_CONTROL = "public, max-age=31536000, immutable"


def cliente_r2():
    faltantes = [v for v in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID",
                             "R2_SECRET_ACCESS_KEY", "R2_BUCKET")
                 if not os.getenv(v)]
    if faltantes:
        sys.exit(f"Faltan variables en .env: {', '.join(faltantes)}")

    return boto3.client(
        "s3",
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        config=Config(signature_version="s3v4", region_name="auto"),
    )


def ya_existe(s3, bucket: str, key: str, bytes_local: int) -> bool:
    """True si el objeto ya está subido con el mismo tamaño."""
    try:
        return s3.head_object(Bucket=bucket, Key=key)["ContentLength"] == bytes_local
    except ClientError as e:
        if e.response["Error"]["Code"] in ("404", "NoSuchKey"):
            return False
        raise


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("origen", type=Path)
    ap.add_argument("--prefijo", default="", help="prefijo para las keys en el bucket")
    ap.add_argument("--forzar", action="store_true",
                    help="re-subir aunque el objeto ya exista")
    args = ap.parse_args()

    if not args.origen.is_dir():
        sys.exit(f"No existe el directorio {args.origen}")

    s3 = cliente_r2()
    bucket = os.environ["R2_BUCKET"]

    archivos = sorted(p for p in args.origen.rglob("*") if p.is_file())
    subidos = omitidos = 0
    total = 0

    for archivo in archivos:
        # Las keys usan siempre '/' aunque el script corra en Windows.
        key = args.prefijo + archivo.relative_to(args.origen).as_posix()
        tam = archivo.stat().st_size

        if not args.forzar and ya_existe(s3, bucket, key, tam):
            omitidos += 1
            continue

        tipo = mimetypes.guess_type(archivo.name)[0] or "application/octet-stream"
        s3.upload_file(
            str(archivo), bucket, key,
            ExtraArgs={"ContentType": tipo, "CacheControl": CACHE_CONTROL},
        )
        subidos += 1
        total += tam
        print(f"  subido  {key}  ({tam / 1024 / 1024:.1f} MB)")

    print(f"\n  subidos  : {subidos}  ({total / 1024 / 1024:.1f} MB)")
    print(f"  omitidos : {omitidos} (ya estaban en el bucket)")


if __name__ == "__main__":
    main()
