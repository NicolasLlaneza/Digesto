# Origen y particularidades de los datos

El índice se arma a partir de las planillas anuales que ya lleva la
Municipalidad, una por año, con una hoja por tipo de norma. Este documento
registra lo que hay que saber para interpretarlas, y para no confundir una
particularidad conocida con un error de carga.

## Dos formatos

Las planillas cambiaron de estructura cuando cambió el sistema de gestión.

| | 2009–2021 (primera mitad) | 2021 (segunda mitad)–2025 |
|---|---|---|
| Archivo | `.xls` | `.xlsx` |
| Encabezado | una fila, en la 0, 1 o 2 | dos filas, con rótulos agrupadores |
| Fecha | número de serie de Excel | texto o fecha real |
| Expediente | un campo: `17701-DEV-12` | tres columnas: tipo, número, año |
| Texto | repartido en `CONCEPTO` y `TRÁMITE` | una sola columna |
| Otras columnas | `MONTO`, `ORIGEN` | — |

El importador detecta cuál es cada una: ubica el encabezado buscando la
columna de fecha, que existe en todos los formatos, y mapea las columnas por
nombre en vez de por posición.

## El salto de numeración de 2021

**Los decretos 891 a 999 de 2021 no existen, y es intencional.**

2021 es el año de la transición. La planilla viene partida en dos archivos:
`Parte1` con el formato viejo, hasta el decreto 890, y `Parte2` con el formato
nuevo, desde el 1000. El tramo intermedio se dejó sin usar a propósito, para
que el sistema nuevo no reasignara números que el viejo ya había emitido.

No hay nada que recuperar ahí. Es el único hueco de numeración en los diez
años cargados.

## Series con numeración propia

`RESOLUCION PERSONAL` aparece como hoja separada en 2009 y numera desde 1, en
paralelo a las resoluciones generales. Se carga con el tipo
`resolucion_personal` para que la Resolución de Personal N° 1 no se confunda
con la Resolución N° 1.

## Nada se descarta

Cada fila guarda en la columna `origen` **todas las celdas tal como vinieron**,
indexadas por el nombre de su columna, más la hoja y el número de fila de
procedencia. Las columnas normalizadas —`numero`, `fecha`, `exp_tipo`,
`exp_numero`, `exp_anio`— son una vista derivada que existe para poder buscar
y filtrar.

Cuando la normalización no puede interpretar un valor, lo deja en blanco en su
columna y lo anota en `origen.sin_normalizar`. Para encontrar esas filas:

```sql
select numero, anio, tipo, origen
from indice_normas
where jsonb_array_length(origen -> 'sin_normalizar') > 0;
```

Las columnas del formato viejo que no tienen equivalente —`MONTO`, `ORIGEN`,
`TRÁMITE`— también quedan en `origen`, así que se pueden recuperar si alguna
vez hacen falta.

## Datos incompletos en el origen

Las planillas viejas están menos completas que las recientes, y eso viaja tal
cual a la base:

| Año | Normas sin fecha |
|---|---|
| 2009 | 423 |
| 2013 | 233 |
| 2021 | 466 |
| 2023 | 1 |

Unas 5.800 normas no tienen expediente asociado; en la mayoría la celda de
origen dice literalmente `S/. EXPTE.`, o sea que no lo tienen, no que se haya
perdido en la conversión.

## Reimportar un año

La carga suma, no reemplaza, y no hay restricción de unicidad —en los datos
reales hay números repetidos, y rechazarlos perdería normas legítimas—. Así
que para rehacer un año hay que borrarlo antes:

```sql
delete from indice_normas where anio = 2021;
```

Eso no toca los demás años.
