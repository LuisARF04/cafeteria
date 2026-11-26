# Cafetería — carta y pedidos por QR

Web para pedir desde la mesa escaneando un QR, con panel para la cocina.
Sin instalar nada, sin librerías externas y pensada para internet lento.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | Lo que ve el cliente: carta, carrito, dividir cuenta, enviar pedido |
| `admin.html` | Panel del negocio: pedidos en vivo, carta, ajustes, QR de mesas |
| `config.js`  | URL y clave pública de Supabase + cliente REST mínimo (~2 KB) |
| `404.html`   | Convierte `/mesa/4` en `/?mesa=4` para que los QR queden bonitos |

## Cómo se usa

- **Cliente:** escanea el QR de su mesa → `…/mesa/4`. La mesa queda fijada 2 h o hasta confirmar el pedido. No hay registro ni login.
- **Trabajador:** `admin.html`, o el enlace «Soy trabajador» en el menú lateral.
  - `dueno / 1234` → todo
  - `trabajador / 1234` → solo pedidos y disponibilidad

> **Cambia esas contraseñas** desde Ajustes → Cambiar mi contraseña antes de usarla en el negocio.

## Pensado para internet lento

- Cero librerías y cero tipografías externas: la página pesa unos pocos KB.
- La carta se guarda en el teléfono y abre al instante; se actualiza por detrás.
- Las fotos se reducen a 420 px al subirlas, se descargan una sola vez y quedan guardadas.
- Si se cae la conexión al confirmar, el pedido queda en cola y se envía solo cuando vuelve.
- El panel entra sin internet con la sesión ya guardada en ese equipo.

## Base de datos (Supabase)

Tablas: `productos`, `producto_img`, `categorias`, `pedidos`, `mesas`, `config`, `usuarios`.

Las contraseñas se guardan con `bcrypt` y la tabla `usuarios` **no es legible** con la clave
pública: el login pasa por las funciones `login_admin`, `cambiar_pass`, `crear_usuario`
y `listar_usuarios`.

### Nota de seguridad

La clave que va en `config.js` es la clave *pública* (anon) y está pensada para vivir en el
navegador. Con ella, las tablas de la carta y los pedidos se pueden leer y escribir. Para una
cafetería pequeña es el compromiso normal: lo peor que puede pasar es que alguien que lea el
código fuente cree un pedido falso o edite un precio. Si más adelante quieres cerrarlo del todo,
hay que mover las escrituras del panel a Supabase Auth con políticas por rol.

## Cambiar de proyecto Supabase

Edita solo `config.js`:

```js
window.SB_URL = 'https://TU-PROYECTO.supabase.co';
window.SB_KEY = 'tu_clave_publica';
```
