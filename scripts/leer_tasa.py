#!/usr/bin/env python3
"""Lee la tasa informal del dólar del canal público de El Toque en Telegram
y la guarda en la configuración de la cafetería (Supabase).

No usa ninguna clave de Supabase: solo un token que sirve únicamente para
escribir la tasa. Se le pasa por la variable de entorno TOKEN_TASA.

El canal publica mensajes así:

    Actualización de tasas de mercado informal de divisas en Cuba
    Fecha: 25/11/2026
    USD: 950.00 CUP
    MLC: 467.00 CUP

El formato ha cambiado antes, así que se prueban varias formas de escribirlo
y, si ninguna aparece, el programa falla a propósito: más vale que GitHub te
avise por correo a que la cafetería enseñe una tasa vieja sin que nadie lo note.
"""
import json
import os
import re
import sys
import urllib.request

CANAL = 'https://t.me/s/eltoquecom2'
SB_URL = os.environ.get('SB_URL', '').rstrip('/')
SB_KEY = os.environ.get('SB_KEY', '')
TOKEN = os.environ.get('TOKEN_TASA', '')
NAVEGADOR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'


def bajar(url, datos=None, cabeceras=None):
    pet = urllib.request.Request(url, data=datos, headers=cabeceras or {'User-Agent': NAVEGADOR})
    with urllib.request.urlopen(pet, timeout=45) as r:
        return r.read().decode('utf-8', 'ignore')


def texto_plano(html):
    t = re.sub(r'<br\s*/?>', ' ', html)
    t = re.sub(r'<[^>]+>', ' ', t)
    t = t.replace('&nbsp;', ' ').replace('&amp;', '&')
    return re.sub(r'\s+', ' ', t)


def buscar(texto, codigo):
    """Devuelve el último valor publicado para esa moneda, que es el más reciente."""
    patrones = [
        codigo + r'\s*:\s*([0-9][0-9.,]*)\s*CUP',      # USD: 950.00 CUP
        codigo + r'\s+([0-9][0-9.,]*)\s*CUP',          # USD 950 CUP
        r'1\s*' + codigo + r'\s*=\s*([0-9][0-9.,]*)',  # 1 USD = 950
        codigo + r'\s*[→-]\s*([0-9][0-9.,]*)',         # USD → 950
    ]
    for p in patrones:
        hallados = re.findall(p, texto, re.I)
        if hallados:
            return limpiar(hallados[-1])
    return None


def limpiar(s):
    """'1.124,43' y '1,124.43' y '950.00' tienen que dar el mismo tipo de número."""
    s = s.strip()
    if ',' in s and '.' in s:
        s = s.replace('.', '').replace(',', '.') if s.rindex(',') > s.rindex('.') \
            else s.replace(',', '')
    elif ',' in s:
        entero, _, dec = s.rpartition(',')
        s = entero.replace(',', '') + '.' + dec if len(dec) <= 2 else s.replace(',', '')
    try:
        return float(s)
    except ValueError:
        return None


def main():
    if not (SB_URL and SB_KEY and TOKEN):
        sys.exit('Faltan SB_URL, SB_KEY o TOKEN_TASA en el entorno.')

    try:
        html = bajar(CANAL)
    except Exception as e:
        sys.exit(f'No se pudo leer el canal de Telegram: {e}')

    texto = texto_plano(html)
    usd = buscar(texto, 'USD')
    mlc = buscar(texto, 'MLC')

    if not usd:
        print('No se encontró ninguna tasa de USD. Últimos 1500 caracteres leídos:')
        print(texto[-1500:])
        sys.exit('El formato del canal cambió: hay que revisar los patrones de este script.')

    if not (50 <= usd <= 100000):
        sys.exit(f'La tasa leída ({usd}) está fuera de lo razonable. No se guarda.')

    cuerpo = json.dumps({'p_token': TOKEN, 'p_usd': usd, 'p_mlc': mlc}).encode()
    try:
        r = bajar(SB_URL + '/rest/v1/rpc/actualizar_tasa', cuerpo, {
            'apikey': SB_KEY,
            'Authorization': 'Bearer ' + SB_KEY,
            'Content-Type': 'application/json',
            'User-Agent': NAVEGADOR,
        })
    except Exception as e:
        sys.exit(f'No se pudo escribir en Supabase: {e}')

    if r.strip().lower() != 'true':
        sys.exit(f'Supabase rechazó la actualización (¿token incorrecto?). Respondió: {r.strip()}')

    print(f'Tasa guardada — USD {usd} CUP' + (f', MLC {mlc} CUP' if mlc else ''))


if __name__ == '__main__':
    main()
