<p align="right"><b>Español</b> · <a href="costs.md">English</a> · <a href="de/costs.md">Deutsch</a> · <a href="zh/costs.md">简体中文</a> · <a href="ko/costs.md">한국어</a> · <a href="ja/costs.md">日本語</a></p>

# Costos de la API de Claude

Lo que cuesta usar Kotonoha con una clave propia de la API de Claude, medido con videos reales el 5 de noviembre de 2026. La tarjeta **Gasto en Claude** de la pantalla de inicio muestra el consumo exacto de cada instalación, con los tokens que informa la API.

Los subtítulos, el diccionario, el furigana, las tarjetas, el repaso y la transcripción con Whisper no usan la API y no cuestan nada.

## Resumen

Con el crédito de referencia de 100 USD al mes:

| Uso del video | Coste por hora | Horas al mes con 100 USD |
|---|---|---|
| Subtítulos automáticos, con corrección, revisión y traducción | 1.39 USD | 62 |
| Subtítulos automáticos, con corrección y revisión | 1.00 USD | 82 |
| Subtítulos manuales, con revisión y traducción | 0.75 USD | 104 |
| Subtítulos manuales, con revisión | 0.36 USD | 175 |

Las horas de la última columna incluyen 30 consultas de palabras por hora de video. Volver a ver un video no cuesta nada, porque lo revisado, corregido y traducido queda guardado.

## Medidas

Cada coste se obtuvo con el saldo de Claude Console antes y después de la operación, con los modelos y esfuerzos por omisión. El saldo tiene una resolución de un centavo, de modo que cada cifra tiene un margen de ±0.01 USD.

| Operación | Video | Coste medido |
|---|---|---|
| Revisión de lecturas, sentidos y gramática | 6:41, subtítulos manuales | 0.04 USD |
| Corrección y revisión | 10:46, subtítulos automáticos, 154 líneas | 0.18 USD |
| Traducción al español | El mismo video, 150 líneas | 0.07 USD |
| Significado en la frase, con el guion completo como contexto | 5 palabras | 0.03 USD |

Por hora de video resultan estas tarifas. La corrección se obtiene de restar la revisión a la segunda medida.

| Tarea | Por hora de video | Por 10 minutos |
|---|---|---|
| Corrección de subtítulos automáticos | 0.64 USD | 0.11 USD |
| Traducción | 0.39 USD | 0.07 USD |
| Revisión de lecturas, sentidos y gramática | 0.36 USD | 0.06 USD |

El coste depende de cuánto se hable. Estos videos tienen unas 14 líneas por minuto, y un video con más diálogo cuesta en proporción.

### Consultas de palabras

| Consulta | Coste aproximado | Origen |
|---|---|---|
| Abrir una palabra: diccionario | 0 USD | No hace ninguna petición |
| Volver a una palabra ya consultada en esa frase | 0 USD | Sale de lo guardado |
| ¿Qué significa en esta frase? | 0.006 USD | Medido, y como máximo: la medida incluye el guion completo |
| Explicar, desglosar | 0.01 USD | Estimado por tokens |
| Traducir una frase | 0.002 USD | Estimado por tokens |
| Profundizar, con Opus 5.5 | 0.06 USD | Estimado por tokens |
| Crear una tarjeta con traducción y explicación de Claude | 0.012 USD | Estimado por tokens. Se puede desactivar en Ajustes, Tarjetas y Anki |

## Por video

| Video | Sin traducción | Con traducción |
|---|---|---|
| YouTube de 20 minutos, subtítulos automáticos | 0.33 USD | 0.46 USD |
| Episodio de 24 minutos, subtítulos manuales | 0.14 USD | 0.30 USD |
| Película de 2 horas, subtítulos manuales | 0.72 USD | 1.50 USD |

## Al mes

Con subtítulos automáticos, traducción y 30 consultas de palabras por hora de video:

| Uso | Horas al mes | Video | Consultas | Total | Del crédito de 100 USD |
|---|---|---|---|---|---|
| 20 minutos al día | 10 | 13.90 USD | 2.10 USD | 16 USD | 16 % |
| 1 hora al día | 30 | 41.70 USD | 6.30 USD | 48 USD | 48 % |
| 2 horas al día | 60 | 83.40 USD | 12.60 USD | 96 USD | 96 % |
| 3 horas al día | 90 | 125.10 USD | 18.90 USD | 144 USD | Se supera |

Con subtítulos manuales y sin traducir, porque el video ya los trae en español:

| Uso | Horas al mes | Video | Consultas | Total | Del crédito de 100 USD |
|---|---|---|---|---|---|
| 1 hora al día | 30 | 10.80 USD | 6.30 USD | 17 USD | 17 % |
| 3 horas al día | 90 | 32.40 USD | 18.90 USD | 51 USD | 51 % |

## Precios

Precios por millón de tokens, en dólares. El razonamiento del modelo se factura como salida.

| Modelo | Entrada | Salida | Lectura de caché | Escritura de caché, 5 min | Escritura de caché, 1 h |
|---|---|---|---|---|---|
| Claude Sonnet 5.5 | 2 | 10 | 0.20 | 2.50 | 4 |
| Claude Opus 5.5 | 4 | 20 | 0.20 | 5 | 8 |
| Claude Haiku 5.5 | 0.10 | 0.50 | 0.01 | 0.125 | 0.20 |

## Cómo se evita gastar

| Medida | Efecto |
|---|---|
| La ficha abre con el diccionario | Pasar el ratón por una palabra ya no hace ninguna petición |
| Cada respuesta se guarda 90 días, por palabra y frase | Ir y venir entre palabras, o volver al mismo video, no cuesta nada |
| Una petición en marcha no se cancela | Cambiar de palabra no tira lo ya pagado: termina, se guarda y queda disponible |
| Dos consultas iguales a la vez comparten la misma petición | No se paga dos veces por impaciencia |
| La revisión avanza con el video | Abandonar una película a los 10 minutos no cuesta la película entera |
| El guion completo es opcional en las consultas | Cada consulta envía 40 líneas de contexto, no el video entero |

## Cómo gastar menos

| Ajuste | Dónde | Ahorro por hora de video |
|---|---|---|
| Traducir solo cuando haga falta | Generar subtítulos | 0.39 USD |
| No revisar a medida que avanza | Generar subtítulos | 0.36 USD |
| No corregir los automáticos al abrirlos | Generar subtítulos | 0.64 USD |
| Un modelo o un esfuerzo menor por tarea | Ajustes, Claude | Depende de la tarea, y puede afectar a la calidad |

Las tres primeras se pueden seguir pidiendo con su botón en el video que interese.
