# Cafetería — carta y pedidos por QR

El cliente escanea el QR de su mesa, ve la carta y manda el pedido. La cocina lo ve
aparecer en su panel. Sin instalar nada, sin librerías externas y pensado para que
abra rápido con la conexión que hay en Cuba.

## Cómo se usa

**Cliente.** Escanea el QR de su mesa y cae en `…/mesa/4`. La mesa queda fijada arriba
durante 2 horas o hasta que confirme el pedido. No hay registro ni login. Puede buscar,
filtrar por categoría, armar su pedido y **dividir la cuenta** arrastrando cada artículo
a la persona que lo paga.

**Panel.** En `admin.html`, o desde «Soy trabajador» en el menú lateral de la carta.

| | |
|---|---|
| Usuario | `ADMIN` |
| Contraseña | `abcdefg1` |

> Cámbiala en Ajustes → Cambiar mi contraseña antes de ponerla en marcha.

Desde el panel: pedidos en vivo con sus estados, carta completa (crear, editar, borrar,
agotar), categorías, datos de la tienda, horario, tasa de cambio y los QR de las mesas.

## Estructura

```
index.html          carta del cliente
admin.html          panel del negocio
404.html            convierte /mesa/4 en /?mesa=4 (para que los QR queden limpios)
assets/
  config.js         URL y clave pública de Supabase — lo único que se cambia de proyecto
  api.js            cliente REST y sesión, escritos a mano (~3 KB)
  qr.js             generador de códigos QR en JavaScript puro
  base.css          colores, tipografía y piezas comunes
  cliente.css       la carta
  admin.css         el panel
docs/
  esquema.sql       base de datos completa, lista para ejecutar en otro proyecto
  SEGURIDAD.md      qué puede hacer cada quien y por qué
```

## Por qué está hecho así

**Nada de librerías.** `supabase-js` pesa unos 120 KB; el cliente REST de `api.js` hace
lo mismo en 3 KB. Tampoco hay tipografías de Google: todo usa la del sistema. La carta
completa entra en pocos KB.

**La caché manda.** La carta se guarda en el teléfono y se dibuja al instante al abrir;
la versión nueva se busca por detrás y se actualiza sola. En la segunda visita abre sin
esperar a la red.

**Las fotos pesan aparte.** Viven en su propia tabla, se reducen a 420 px al subirlas,
se descargan solo cuando el producto aparece en pantalla y después quedan guardadas.
Un producto sin foto usa un emoji y no descarga nada.

**Los QR se dibujan aquí.** `qr.js` codifica los QR en el propio teléfono: no depende de
ningún servicio de internet, así que funciona aunque la cafetería esté sin conexión. Está
verificado decodificando lo que genera en versiones 1 a 10, con acentos y con el chequeo
de corrección de errores.

**Si se cae la conexión.** El pedido se guarda en cola y se reenvía solo cuando vuelve la
señal; el cliente puede cerrar la página. Sale un aviso arriba para que nadie se quede
con la duda.

**La carta se lee como la carta.** Fila por fila, con los ingredientes debajo y el precio
grande a la derecha, igual que la de papel. Se lee más rápido y carga menos que una
rejilla de tarjetas con foto.

## Seguridad

El cliente solo puede leer la carta y crear su pedido. No puede ver los pedidos de otras
mesas, cambiarles el estado ni tocar precios: eso lo bloquea la base de datos, no el
navegador. El panel entra con Supabase Auth y contraseña con bcrypt.

Los detalles, incluida la contrapartida (el panel ya no entra sin internet), están en
[`docs/SEGURIDAD.md`](docs/SEGURIDAD.md).

## Mover a otro proyecto de Supabase

1. Ejecuta [`docs/esquema.sql`](docs/esquema.sql) en el SQL Editor del proyecto nuevo.
2. Cambia las dos líneas de `assets/config.js`.

## Publicar

Funciona en cualquier hosting de archivos estáticos. Con GitHub Pages:
Settings → Pages → Branch `main`, carpeta `/ (root)`.
