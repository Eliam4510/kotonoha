# La referencia del corpus del chino (src/lenguas/chino/corpus-pinyin.json): cómo parte jieba cada frase y qué pinyin le da
# pypinyin a cada carácter, con el tono de diccionario y sin el sandhi de 一 y 不. Las frases son las que ya trae el
# corpus (80 de hoy y 120 de 《故乡》, de Lu Xun, de dominio público); esto solo rehace la referencia.
#
# Uso, en un entorno aparte con las mismas versiones:
#   python -m venv .venv-corpus
#   .venv-corpus/Scripts/python -m pip install jieba==0.42.1 pypinyin==0.55.0
#   .venv-corpus/Scripts/python -I herramientas/corpus-pinyin.py src/lenguas/chino/corpus-pinyin.json
import json
import sys

import jieba
from pypinyin import Style, pinyin

jieba.setLogLevel(60)
ruta = sys.argv[1]
corpus = json.load(open(ruta, encoding='utf-8'))
for f in corpus['frases']:
    f['palabras'] = jieba.lcut(f['texto'])
    f['pinyin'] = [s[0] for s in pinyin(f['texto'], style=Style.TONE, heteronym=False, errors=lambda x: list(x))]
    assert len(f['pinyin']) == len(f['texto']), f['texto']
lineas = [json.dumps(f, ensure_ascii=False, separators=(',', ':')) for f in corpus['frases']]
cabecera = '{"referencia":' + json.dumps(corpus['referencia'], ensure_ascii=False) + ',"frases":[\n'
open(ruta, 'w', encoding='utf-8', newline='\n').write(cabecera + ',\n'.join(lineas) + '\n]}\n')
print(len(lineas), 'frases')
