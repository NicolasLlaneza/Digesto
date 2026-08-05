#!/usr/bin/env python3
"""Comprime un árbol de documentos para que entre en el free tier de R2.

Recorre ORIGEN recursivamente, comprime lo que convenga y espeja la estructura
de carpetas en DESTINO. Los archivos que no se pueden mejorar se copian tal cual,
así DESTINO siempre queda como un reemplazo completo de ORIGEN.

    python scripts/compress.py ./originales ./comprimidos
    python scripts/compress.py ./originales ./comprimidos --dpi 200
    python scripts/compress.py ./originales --muestra 20      # solo estimar

Hay dos motores de compresión y por defecto usa el que encuentre disponible:

  ghostscript  Binario externo. Da el mejor resultado, pero instalarlo en
               Windows suele pedir permisos de administrador.

                   apt install ghostscript   /   brew install ghostscript
                   Windows: https://ghostscript.com/releases/gsdnld.html

               Si es una instalación portable, pasale la ruta:
                   --gs C:\\ruta\\a\\gswin64c.exe

  pymupdf      Solo paquetes de pip, sin permisos de administrador:

                   pip install --user pymupdf pillow

Con `--motor` se fuerza uno u otro.
"""

import argparse
import io
import shutil
import subprocess
import sys
from pathlib import Path

# Nombres del ejecutable según plataforma. En Windows el binario de consola
# es gswin64c.exe; el que no lleva "c" abre una ventana y no sirve acá.
NOMBRES_GS = ("gs", "gswin64c", "gswin32c")

# Se resuelven una sola vez en main().
GS = "gs"
MOTOR = "ghostscript"

# Calidad JPEG del motor pymupdf. 75 es el punto donde un escaneo de texto
# todavía se lee limpio sin artefactos visibles.
CALIDAD_JPEG = 75

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
    if MOTOR == "pymupdf":
        return comprimir_pymupdf(origen, destino, dpi)
    return comprimir_ghostscript(origen, destino, perfil, dpi)


def comprimir_pymupdf(origen: Path, destino: Path, dpi: int) -> bool:
    """Remuestrea a JPEG las imágenes embebidas, sin binarios externos.

    Ataca lo mismo que Ghostscript —el peso de un escaneo está en sus
    imágenes— pero con paquetes de pip, que es lo instalable en una máquina
    sin permisos de administrador.
    """
    import fitz
    from PIL import Image

    try:
        doc = fitz.open(origen)
    except Exception as e:
        print(f"    no se pudo abrir: {e}", file=sys.stderr)
        return False

    try:
        for pagina in doc:
            # El ancho de página está en puntos (1/72"), así que de ahí sale
            # cuántos píxeles hacen falta para el DPI pedido.
            objetivo = max(1, int(pagina.rect.width / 72 * dpi))

            for imagen in pagina.get_images(full=True):
                xref = imagen[0]
                try:
                    original = doc.extract_image(xref)["image"]
                    im = Image.open(io.BytesIO(original))

                    if im.width > objetivo:
                        alto = max(1, int(im.height * objetivo / im.width))
                        im = im.resize((objetivo, alto), Image.LANCZOS)
                    if im.mode not in ("RGB", "L"):
                        im = im.convert("RGB")

                    buf = io.BytesIO()
                    im.save(buf, format="JPEG", quality=CALIDAD_JPEG, optimize=True)

                    # Solo se reemplaza si la versión nueva pesa menos.
                    if buf.tell() < len(original):
                        pagina.replace_image(xref, stream=buf.getvalue())
                except Exception:
                    # Una imagen problemática no invalida el resto del archivo.
                    continue

        doc.save(destino, garbage=4, deflate=True)
        return destino.exists() and destino.stat().st_size > 0
    except Exception as e:
        print(f"    pymupdf falló: {e}", file=sys.stderr)
        return False
    finally:
        doc.close()


def comprimir_ghostscript(origen: Path, destino: Path, perfil: str, dpi: int) -> bool:
    cmd = [
        GS,
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
        print("    timeout, se conserva el original", file=sys.stderr)
    except subprocess.CalledProcessError as e:
        detalle = e.stderr.decode(errors="replace").strip().splitlines()
        print(f"    ghostscript falló: {detalle[-1] if detalle else e}", file=sys.stderr)
    return False


AYUDA_GS = (
    "  Ghostscript (mejor resultado, suele pedir permisos de administrador)\n"
    "    Linux   : apt install ghostscript\n"
    "    macOS   : brew install ghostscript\n"
    "    Windows : https://ghostscript.com/releases/gsdnld.html\n"
    "    Portable: pasale la ruta con --gs C:\\ruta\\a\\gswin64c.exe\n"
)

AYUDA_PYMUPDF = (
    "  PyMuPDF (solo pip, sin permisos de administrador)\n"
    "    pip install --user pymupdf pillow\n"
)


def buscar_gs(explicito: str | None) -> str | None:
    if explicito:
        if not Path(explicito).is_file():
            sys.exit(f"No existe el ejecutable {explicito}")
        return explicito

    for nombre in NOMBRES_GS:
        if ruta := shutil.which(nombre):
            return ruta
    return None


def hay_pymupdf() -> bool:
    try:
        import fitz  # noqa: F401
        from PIL import Image  # noqa: F401
        return True
    except ImportError:
        return False


def resolver_motor(pedido: str, gs_explicito: str | None) -> tuple[str, str | None]:
    """Elige el motor de compresión y, si aplica, el binario de Ghostscript."""
    gs = buscar_gs(gs_explicito)

    if pedido == "ghostscript":
        if not gs:
            sys.exit("No se encontró Ghostscript.\n\n" + AYUDA_GS)
        return "ghostscript", gs

    if pedido == "pymupdf":
        if not hay_pymupdf():
            sys.exit("Falta PyMuPDF y/o Pillow.\n\n" + AYUDA_PYMUPDF)
        return "pymupdf", None

    # auto: Ghostscript comprime algo mejor, así que tiene prioridad.
    if gs:
        return "ghostscript", gs
    if hay_pymupdf():
        return "pymupdf", None

    sys.exit(
        "No hay ningún motor de compresión disponible.\n"
        "Instalá alguno de estos:\n\n" + AYUDA_GS + "\n" + AYUDA_PYMUPDF
    )


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


def estimar(origen: Path, perfil: str, dpi: int, n: int):
    """Comprime una muestra y extrapola el resultado a todo el árbol.

    Sirve para saber en un minuto si el corpus entra en el free tier, sin
    esperar a que Ghostscript procese cientos de archivos.
    """
    import tempfile

    pdfs = sorted(p for p in origen.rglob("*.pdf") if p.stat().st_size >= MIN_BYTES)
    if not pdfs:
        sys.exit(f"No se encontraron PDFs de más de {MIN_BYTES // 1024} KB en {origen}")

    otros = [p for p in origen.rglob("*")
             if p.is_file() and p not in set(pdfs)]
    bytes_pdfs = sum(p.stat().st_size for p in pdfs)
    bytes_otros = sum(p.stat().st_size for p in otros)

    # Muestra repartida en todo el listado, para no medir solo los primeros
    # archivos (que suelen estar ordenados por fecha y no ser representativos).
    n = min(n, len(pdfs))
    paso = len(pdfs) / n
    muestra = [pdfs[int(i * paso)] for i in range(n)]

    print(f"Midiendo {n} de {len(pdfs)} PDFs ({mb(bytes_pdfs)} en total)\n")

    antes = despues = 0
    with tempfile.TemporaryDirectory() as tmp:
        for i, pdf in enumerate(muestra, 1):
            tam = pdf.stat().st_size
            salida = Path(tmp) / f"{i}.pdf"

            if comprimir_pdf(pdf, salida, perfil, dpi):
                nuevo = salida.stat().st_size
                # Misma regla que el modo real: si no mejora, se conserva.
                nuevo = min(nuevo, tam) if (1 - nuevo / tam) >= GANANCIA_MINIMA else tam
            else:
                nuevo = tam

            antes += tam
            despues += nuevo
            print(f"  [{i}/{n}] {pdf.name}  {mb(tam)} -> {mb(nuevo)}  "
                  f"(-{1 - nuevo / tam:.0%})")

    ratio = despues / antes
    estimado = bytes_pdfs * ratio + bytes_otros

    print(f"\n{'=' * 46}")
    print(f"  ratio medido en la muestra : {1 - ratio:.0%} de ahorro")
    print(f"  tamaño actual del árbol    : {mb(bytes_pdfs + bytes_otros)}")
    print(f"  estimado tras comprimir    : {mb(estimado)}")
    print(f"\n  Free tier de R2 (10 GB):")
    print(f"    esta carpeta usaría el {estimado / (10 * 1024 ** 3):.1%}")
    cabidas = int(10 * 1024 ** 3 // estimado) if estimado else 0
    print(f"    entrarían ~{cabidas} carpetas de este tamaño")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("origen", type=Path)
    ap.add_argument("destino", type=Path, nargs="?")
    ap.add_argument("--perfil", choices=PERFILES, default="ebook")
    ap.add_argument("--dpi", type=int, default=150,
                    help="resolución de las imágenes embebidas (default: 150)")
    ap.add_argument("--dry-run", action="store_true",
                    help="solo lista qué se comprimiría, sin escribir nada")
    ap.add_argument("--muestra", type=int, metavar="N",
                    help="comprime solo N archivos repartidos por el árbol y "
                         "extrapola el resultado al total (no escribe DESTINO)")
    ap.add_argument("--gs", metavar="RUTA",
                    help="ruta al ejecutable de Ghostscript, para instalaciones "
                         "portables que no están en el PATH")
    ap.add_argument("--motor", choices=("auto", "ghostscript", "pymupdf"),
                    default="auto",
                    help="motor de compresión (default: el que esté disponible)")
    args = ap.parse_args()

    if not args.origen.is_dir():
        sys.exit(f"No existe el directorio {args.origen}")

    global GS, MOTOR
    MOTOR, GS = resolver_motor(args.motor, args.gs)
    print(f"Motor: {MOTOR}\n")

    if args.muestra:
        estimar(args.origen, args.perfil, args.dpi, args.muestra)
        return

    if args.destino is None:
        sys.exit("Falta el directorio DESTINO (o usá --muestra N para estimar)")

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
