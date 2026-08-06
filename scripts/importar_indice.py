#!/usr/bin/env python3
"""Convierte las planillas de índice a un CSV listo para importar.

Las planillas vienen una por año, con una hoja por tipo de norma y un
encabezado de dos niveles:

    fila 1:  DECRETO           |  EXPEDIENTE
    fila 2:  NUMERO INDICE FECHA |  TIPO NUMERO AÑO
    fila 3+: datos

La salida es un CSV que se importa desde el panel de Supabase
(Table Editor -> indice_normas -> Import data from CSV), sin necesidad de
tener credenciales ni de instalar nada más.

    python scripts/importar_indice.py "DGSTO. MPAL. 2.025.xlsx"
    python scripts/importar_indice.py planilla.xlsx --anio 2024 -o salida.csv

Los datos de origen traen inconsistencias —tipos de expediente escritos de
varias formas, años imposibles, filas corridas—, así que se normaliza lo que
tiene arreglo y se informa lo que no.
"""

import argparse
import csv
import json
import re
import sys
import unicodedata
from datetime import datetime
from pathlib import Path

import openpyxl

# Nombre de hoja -> tipo de norma. Se compara normalizado.
TIPOS_HOJA = {
    "decretos": "decreto",
    "resoluciones": "resolucion",
    "ordenanzas": "ordenanza",
    "disposiciones": "disposicion",
}

# Formas en que aparece escrito el tipo de expediente en las planillas.
TIPOS_EXPEDIENTE = {
    "ee": "EE",
    "aee": "EE",
    "ne": "NE",
    "nee": "NEE",
    "exp": "EXP",
    "esp": "EXP",     # error de tipeo frecuente
    "expediente": "EXP",
}

FORMATOS_FECHA = ("%d/%m/%Y %H:%M", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y")

CAMPOS = ["tipo", "numero", "anio", "fecha", "indice",
          "exp_tipo", "exp_numero", "exp_anio", "origen"]


def normalizar(texto: str) -> str:
    sin_tildes = unicodedata.normalize("NFKD", str(texto))
    return "".join(c for c in sin_tildes if not unicodedata.combining(c)).strip().lower()


def anio_del_nombre(nombre: str) -> int | None:
    """Saca el año del nombre del archivo.

    Vienen escritos como "2.025" con separador de miles, así que se quitan los
    puntos antes de buscar.
    """
    m = re.search(r"(?:19|20)\d{2}", nombre.replace(".", ""))
    return int(m.group()) if m else None


def limpiar_texto(valor) -> str:
    """Colapsa los saltos de línea que el Excel deja dentro de la celda."""
    return re.sub(r"\s+", " ", str(valor)).strip() if valor is not None else ""


def entero(valor):
    if valor is None:
        return None
    if isinstance(valor, int):
        return valor
    m = re.search(r"\d+", str(valor).replace(".", ""))
    return int(m.group()) if m else None


def parsear_fecha(valor):
    """Interpreta la fecha tolerando los errores de tipeo de la planilla.

    Aparecen cosas como '12 :15:28' —espacio antes de los dos puntos— y
    '16/092025', a la que le falta una barra. Son inequívocas, así que se
    corrigen; lo que no se pueda interpretar queda en blanco y el texto
    original se conserva en `origen`.
    """
    if valor is None:
        return None
    if isinstance(valor, datetime):
        return valor.isoformat()

    texto = re.sub(r"\s*:\s*", ":", str(valor).strip())
    texto = re.sub(r"\s+", " ", texto)

    candidatos = [texto]

    # DD/MMYYYY: falta la barra entre mes y año.
    faltante = re.match(r"^(\d{1,2})/(\d{2})(\d{4})\b(.*)$", texto)
    if faltante:
        d, m, a, resto = faltante.groups()
        candidatos.append(f"{d}/{m}/{a}{resto}")

    for candidato in candidatos:
        for formato in FORMATOS_FECHA:
            try:
                return datetime.strptime(candidato, formato).isoformat()
            except ValueError:
                continue
    return None


def tipo_expediente(valor):
    if valor is None:
        return None
    # Un número acá significa fila corrida: la columna no contiene un tipo.
    if isinstance(valor, int):
        return None

    limpio = re.sub(r"[^a-z]", "", normalizar(valor))
    return TIPOS_EXPEDIENTE.get(limpio) or (limpio.upper() or None)


def anio_expediente(valor, anio_norma: int):
    """Normaliza el año del expediente para poder filtrar por él.

    Un expediente no puede ser posterior a la norma que lo resuelve, así que
    ese es el techo. Lo que no entra en un año plausible se deja en blanco
    acá, pero el valor original se conserva en la columna `origen`: no se
    descarta, solo no se lo usa para filtrar.
    """
    n = entero(valor)
    if n is None:
        return None
    if 1980 <= n <= anio_norma:
        return n
    # Año de dos dígitos, escrito como 25 en lugar de 2025.
    if 0 <= n <= 99:
        siglo = 2000 + n
        if siglo <= anio_norma:
            return siglo
    return None


def crudo(valor) -> str:
    """El valor tal como vino de la celda, sin interpretar."""
    if valor is None:
        return ""
    if isinstance(valor, datetime):
        return valor.isoformat()
    return str(valor).strip()


def leer_hoja(ws, tipo: str, anio: int, avisos: list):
    filas = []

    for i, fila in enumerate(ws.iter_rows(min_row=3, values_only=True), start=3):
        numero, indice, fecha, exp_t, exp_n, exp_a = (list(fila) + [None] * 6)[:6]

        if not any(c is not None and str(c).strip() for c in (numero, indice)):
            continue

        n = entero(numero)
        texto = limpiar_texto(indice)

        # Cada celda se interpreta por su cuenta. Antes, un tipo de expediente
        # numérico se tomaba como señal de fila corrida y se descartaba también
        # el número, que muchas veces era válido: la heurística borraba datos
        # buenos. Lo que no se pueda interpretar queda en blanco acá y entero
        # en `origen`.
        normalizado = {
            "numero": n,
            "fecha": parsear_fecha(fecha),
            "exp_tipo": tipo_expediente(exp_t),
            "exp_numero": entero(exp_n),
            "exp_anio": anio_expediente(exp_a, anio),
        }
        original = {
            "numero": crudo(numero),
            "fecha": crudo(fecha),
            "exp_tipo": crudo(exp_t),
            "exp_numero": crudo(exp_n),
            "exp_anio": crudo(exp_a),
            "hoja": ws.title,
            "fila": i,
        }

        # Se deja anotado qué campos la normalización no pudo interpretar, para
        # poder listarlos sin volver a comparar contra la planilla.
        original["sin_normalizar"] = sorted(
            campo for campo, valor in normalizado.items()
            if valor is None and original[campo]
        )

        if n is None:
            avisos.append(f"{ws.title} fila {i}: número '{original['numero']}' "
                          f"no interpretable, se guarda igual")
        # Sin índice se guarda igual: la norma existe y tiene que aparecer al
        # buscarla por número, aunque no se la pueda encontrar por contenido.
        if not texto:
            avisos.append(f"{ws.title} fila {i}: {tipo} {n} sin texto de índice")

        filas.append({
            "tipo": tipo,
            "numero": "" if n is None else n,
            "anio": anio,
            "fecha": normalizado["fecha"] or "",
            "indice": texto,
            "exp_tipo": normalizado["exp_tipo"] or "",
            "exp_numero": "" if normalizado["exp_numero"] is None else normalizado["exp_numero"],
            "exp_anio": "" if normalizado["exp_anio"] is None else normalizado["exp_anio"],
            "origen": json.dumps(original, ensure_ascii=False),
        })

    return filas


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("planilla", type=Path)
    ap.add_argument("--anio", type=int,
                    help="año de las normas (por defecto se toma del nombre)")
    ap.add_argument("-o", "--salida", type=Path,
                    help="CSV de salida (por defecto, junto a la planilla)")
    args = ap.parse_args()

    if not args.planilla.is_file():
        sys.exit(f"No existe el archivo {args.planilla}")

    anio = args.anio or anio_del_nombre(args.planilla.name)
    if not anio:
        sys.exit("No se pudo deducir el año del nombre del archivo. Pasalo con --anio")

    wb = openpyxl.load_workbook(args.planilla, read_only=True, data_only=True)

    todas, avisos = [], []
    for nombre in wb.sheetnames:
        tipo = TIPOS_HOJA.get(normalizar(nombre))
        if not tipo:
            avisos.append(f"Hoja '{nombre}': no se reconoce el tipo de norma, se omite")
            continue

        filas = leer_hoja(wb[nombre], tipo, anio, avisos)
        todas.extend(filas)
        print(f"  {nombre:16} {len(filas):5} normas")

    if not todas:
        sys.exit("No se leyó ninguna fila. ¿Es una planilla de índice?")

    salida = args.salida or args.planilla.with_suffix(".csv")
    with open(salida, "w", newline="", encoding="utf-8") as f:
        escritor = csv.DictWriter(f, fieldnames=CAMPOS)
        escritor.writeheader()
        escritor.writerows(todas)

    print(f"\n  {len(todas)} normas -> {salida}")

    pendientes = [f for f in todas if json.loads(f["origen"])["sin_normalizar"]]
    if pendientes:
        print(f"\n  {len(pendientes)} filas con algún campo sin normalizar.")
        print("  Se guardan igual; el valor original queda en la columna `origen`.")
        for f in pendientes[:10]:
            o = json.loads(f["origen"])
            detalle = ", ".join(f"{c}={o[c]!r}" for c in o["sin_normalizar"])
            print(f"    {f['tipo']} {f['numero']}/{f['anio']}: {detalle}")
        if len(pendientes) > 10:
            print(f"    ... y {len(pendientes) - 10} más")

    if avisos:
        print(f"\n  {len(avisos)} avisos:")
        for a in avisos[:15]:
            print(f"    {a}")
        if len(avisos) > 15:
            print(f"    ... y {len(avisos) - 15} más")


if __name__ == "__main__":
    main()
