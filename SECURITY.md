# Seguridad

[English below](#security-english).

## Versiones con soporte

Solo la [última versión](https://github.com/Eliam4510/kotonoha/releases/latest) recibe correcciones de seguridad.

## Cómo informar de una vulnerabilidad

No se abre una incidencia pública. Se informa en privado desde la pestaña **Security** del repositorio, con **Report a vulnerability**, o en [este enlace](https://github.com/Eliam4510/kotonoha/security/advisories/new).

Conviene incluir la versión, el navegador, los pasos para reproducirla y qué se puede conseguir con ella. Es un proyecto independiente: la respuesta llega en cuanto es posible, normalmente en pocos días.

## Qué protege Kotonoha

- **La clave de la API de Claude** se guarda solo en el almacenamiento de la extensión, en el navegador. Ninguna página web puede leerla, y solo se envía a la API de Anthropic.
- **Los libros** se pintan en una página de la extensión. Antes, cada capítulo pasa por un filtro que deja fuera scripts, marcos, formularios, atributos `on*` y direcciones que no sean del propio libro; la política de seguridad de contenido de la extensión impide además cualquier script en línea.
- **Las páginas web** no cambian: la interfaz de Kotonoha vive en un Shadow DOM propio, y el lector de páginas no reescribe su contenido.
- **El ayudante local**, opcional, solo acepta mensajes de la extensión, mediante Native Messaging.
- No hay servidor propio ni estadísticas de uso. Lo que se envía fuera se detalla en [AVISOS.md](AVISOS.md).

---

# Security (English)

## Supported versions

Only the [latest release](https://github.com/Eliam4510/kotonoha/releases/latest) receives security fixes.

## Reporting a vulnerability

Please do not open a public issue. Report it privately from the repository’s **Security** tab with **Report a vulnerability**, or through [this link](https://github.com/Eliam4510/kotonoha/security/advisories/new).

Include the version, the browser, the steps to reproduce it and what it allows. This is an independent project: you will get an answer as soon as possible, usually within a few days.

## What Kotonoha protects

- **The Claude API key** is stored only in the extension’s storage, in the browser. No web page can read it, and it is sent only to Anthropic’s API.
- **Books** are rendered in an extension page. Each chapter first goes through a filter that removes scripts, frames, forms, `on*` attributes and any address outside the book itself; the extension’s content security policy also blocks inline scripts.
- **Web pages** are not modified: Kotonoha’s interface lives in its own Shadow DOM, and the page reader does not rewrite their content.
- **The optional local helper** only accepts messages from the extension, through Native Messaging.
- There is no server and no usage tracking. Everything sent outside is listed in [AVISOS.md](AVISOS.md#english).
