#!/usr/bin/env python3
"""Comprime un árbol de documentos para que entre en el free tier de R2.

Recorre ORIGEN recursivamente, comprime lo que convenga y espeja la estructura
de carpetas en DESTINO. Los archivos que no se pueden mejorar se copian tal cual,
así DESTINO siempre queda como un reemplazo completo de ORIGEN.

    python scripts/compress.py ./originales ./comprimidos
    python scripts/compress.py ./originales ./comprimidos --dpi 200
    python scripts/compress.py ./originales ./comprimidos --dry-run

Requiere Ghostscript en el PATH:
    apt install ghostscript      /  brew install ghostscript
"""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

# Perfiles de Ghostscript. 150 DPI es el punto donde un escaneo sigue siendo
# cómodo de leer en pantalla y pesa una fracción del original.
PERFILES = {
    "screen": "/screen",    # 72 dpi  - agresivo, para archivo histórico
    "ebook": "/ebook",      # 150 dpi - recomendado
    "printer": "/printer",  # 300 dpi - conserva calidad de impresión
}

# Debajo de este tamaño no vale la pena tocar el archivo.
MIN_BYTES = 300 * 1024

# Si la compresión no gana al menos esto, se conserva el original.
GANANCIA_MINIMA = 0.05


def mb(n: int) -> str:
    return f"{n / 1024 / 1024:.1f} MB"


def comprimir_pdf(origen: Path, destino: Path, perfil: str, dpi: int) -> bool:
    """Devuelve True si el PDF comprimido quedó en `destino`."""
    cmd = [
        "gs",
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        f"-dPDFSETTINGS={PERFILES[perfil]}",
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        "-dDetectDuplicateImages=true",
        # Remuestrea las imágenes embebidas, que es donde está el peso real
        # de un escaneo.
        "-dDownsampleColorImages=true",
        f"-dColorImageResolution={dpi}",
        "-dDownsampleGrayImages=true",
        f"-dGrayImageResolution={dpi}",
        "-dDownsampleMonoImages=true",
        f"-dMonoImageResolution={dpi * 2}",
        f"-sOutputFile={destino}",
        str(origen),
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=300)
        return destino.exists() and destino.stat().st_size > 0
    except subprocess.TimeoutExpired:
        print(f"    timeout, se conserva el original", file=sys.stderr)
    except subprocess.CalledProcessError as e:
        detalle = e.stderr.decode(errors="replace").strip().splitlines()
        print(f"    ghostscript falló: {detalle[-1] if detalle else e}", file=sys.stderr)
    except FileNotFoundError:
        sys.exit("ghostscript no está instalado. Instalalo con: apt install ghostscript")
    return False


def procesar(origen: Path, destino: Path, perfil: str, dpi: int, dry_run: bool):
    total_antes = total_despues = 0
    comprimidos = copiados = 0

    archivos = sorted(p for p in origen.rglob("*") if p.is_file())
    if not archivos:
        sys.exit(f"No se encontraron archivos en {origen}")

    for archivo in archivos:
        relativo = archivo.relative_to(origen)
        salida = destino / relativo
        antes = archivo.stat().st_size
        total_antes += antes

        es_pdf = archivo.suffix.lower() == ".pdf"
        vale_la_pena = es_pdf and antes >= MIN_BYTES

        if not vale_la_pena:
            total_despues += antes
            copiados += 1
            if not dry_run:
                salida.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(archivo, salida)
            continue

        print(f"  {relativo}  ({mb(antes)})")

        if dry_run:
            total_despues += antes
            continue

        salida.parent.mkdir(parents=True, exist_ok=True)
        temporal = salida.with_suffix(".pdf.tmp")

        if not comprimir_pdf(archivo, temporal, perfil, dpi):
            temporal.unlink(missing_ok=True)
            shutil.copy2(archivo, salida)
            total_despues += antes
            copiados += 1
            continue

        despues = temporal.stat().st_size
        ganancia = 1 - despues / antes

        # Un PDF nativo (texto, no escaneado) a veces crece al pasar por
        # Ghostscript. En ese caso el original es la mejor versión.
        if ganancia < GANANCIA_MINIMA:
            temporal.unlink()
            shutil.copy2(archivo, salida)
            total_despues += antes
            copiados += 1
            print(f"    sin mejora ({ganancia:+.0%}), se conserva el original")
        else:
            temporal.replace(salida)
            total_despues += despues
            comprimidos += 1
            print(f"    {mb(antes)} -> {mb(despues)}  (-{ganancia:.0%})")

    return total_antes, total_despues, comprimidos, copiados


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("origen", type=Path)
    ap.add_argument("destino", type=Path)
    ap.add_argument("--perfil", choices=PERFILES, default="ebook")
    ap.add_argument("--dpi", type=int, default=150,
                    help="resolución de las imágenes embebidas (default: 150)")
    ap.add_argument("--dry-run", action="store_true",
                    help="solo lista qué se comprimiría, sin escribir nada")
    args = ap.parse_args()

    if not args.origen.is_dir():
        sys.exit(f"No existe el directorio {args.origen}")

    print(f"Comprimiendo {args.origen} -> {args.destino} "
          f"(perfil {args.perfil}, {args.dpi} dpi)\n")

    antes, despues, comprimidos, copiados = procesar(
        args.origen, args.destino, args.perfil, args.dpi, args.dry_run
    )

    print(f"\n{'=' * 46}")
    print(f"  comprimidos : {comprimidos}")
    print(f"  copiados    : {copiados}")
    print(f"  antes       : {mb(antes)}")
    if not args.dry_run:
        ahorro = 1 - despues / antes if antes else 0
        print(f"  después     : {mb(despues)}  (-{ahorro:.0%})")
        print(f"\n  Free tier de R2: 10 GB -> "
              f"usarías el {despues / (10 * 1024 ** 3):.1%}")


if __name__ == "__main__":
    main()
