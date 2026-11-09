# Publicar Kotonoha en las tiendas

Material preparado para publicar Kotonoha en [Edge Add-ons](https://partner.microsoft.com/dashboard/microsoftedge) (gratis) y en [Chrome Web Store](https://chrome.google.com/webstore/devconsole) (5 dólares, una sola vez). Las cuentas de desarrollador tienen que ser del titular del proyecto: este material no las crea ni sube nada.

| Archivo | Qué es |
|---|---|
| [ficha.md](ficha.md) | Nombre, resumen, descripción y categoría, en español y en inglés |
| [permisos.md](permisos.md) | Propósito único y justificación de cada permiso, para el formulario de revisión |
| [../privacidad.md](../privacidad.md) | Política de privacidad. Su dirección pública: `https://github.com/Eliam4510/kotonoha/blob/main/docs/privacidad.md` |
| [img/](img) | Capturas de 1280×800 en inglés y en español, y el mosaico promocional de 440×280 |

## El paquete

Es el mismo zip de cada versión en GitHub: `kotonoha-X.Y.Z-extension.zip`. No lleva clave en el manifiesto, como piden las tiendas. Las copias de tienda se actualizan solas: no muestran el aviso de versión nueva de GitHub ni «Actualizar ahora».

## Pasos

1. Crear la cuenta de desarrollador (en Chrome Web Store, pagar la cuota de registro).
2. Subir el zip de la última versión.
   - **Chrome Web Store, solo la primera vez:** para que la ficha tenga el mismo identificador que las instalaciones nuevas desde GitHub (`pndmalmeggkhpinfpnfebbknfbmafgep`), se añade a la raíz del zip el archivo `key.pem` que el titular guarda aparte, fuera del repositorio. Sin él, la tienda asigna otro identificador y el instalador del ayudante lo encuentra igualmente.
   - **Edge Add-ons** asigna siempre su propio identificador.
3. Rellenar la ficha con [ficha.md](ficha.md), las capturas de [img/](img) y la dirección de la política de privacidad.
4. En «Prácticas de privacidad», declarar que no se recogen datos de usuario, y copiar el propósito único y las justificaciones de [permisos.md](permisos.md).
5. Enviar a revisión. Con `<all_urls>` y `nativeMessaging`, la revisión puede tardar varios días.

## Lo que conviene vigilar

- Chrome Web Store no permite ejecutar código remoto. Kotonoha descarga modelos y diccionarios, que son datos que lee su propio código; [permisos.md](permisos.md) lo explica.
- La revisión puede pedir capturas o un video del uso de un permiso concreto, sobre todo de `tabCapture`.
