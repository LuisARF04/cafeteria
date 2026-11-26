# Seguridad

Resumen de qué puede hacer cada quien y por qué.

## La clave que está en el código

`assets/config.js` lleva la clave **pública** (publishable) de Supabase. Está pensada
para vivir en el navegador: cualquiera que abra la carta la tiene. Lo que importa no es
esconderla, sino que por sí sola no sirva para nada peligroso. De eso se encarga la base
de datos con *Row Level Security*.

La clave **secreta** (`service_role`) no aparece en ningún archivo de este repo y no debe
aparecer nunca.

## Qué puede hacer un cliente cualquiera

Con la clave pública, sin haber entrado al panel:

| Acción | Permitido |
|---|---|
| Leer la carta, categorías, mesas y datos de la tienda | sí |
| Crear su propio pedido | sí |
| Ver los pedidos de otras mesas | **no** |
| Cambiar el estado de un pedido | **no** |
| Borrar pedidos | **no** |
| Cambiar precios, fotos o disponibilidad | **no** |
| Crear o borrar categorías y productos | **no** |
| Cambiar los datos de la tienda | **no** |

Además, al crear un pedido la base de datos obliga a que:

- el estado sea `nuevo` (nadie puede mandar un pedido ya marcado como entregado);
- el total esté entre 0 y 10 000 000 CUP;
- la mesa tenga entre 1 y 12 caracteres;
- haya entre 1 y 60 artículos y el contenido no pase de 20 KB.

Esto se comprobó ejecutando las consultas con el rol `anon` directamente contra la base.

## Cómo entra el panel

El panel usa **Supabase Auth** con usuario y contraseña reales. El usuario `ADMIN`
corresponde al correo interno `admin@cafeteria.local`; la contraseña se guarda con
bcrypt y ni el código ni la base la devuelven nunca.

Al entrar, Supabase emite un token que dura una hora y se renueva solo. Todas las
escrituras del panel viajan con ese token: sin él, la base rechaza la operación. Si el
token caduca y no se puede renovar, el panel cierra la sesión y pide entrar de nuevo.

## Lo que esto cuesta

El panel ya **no puede entrar sin internet**. Con sesión abierta se siguen viendo los
datos guardados del último rato, pero no se puede guardar nada hasta que vuelva la
conexión, y aparece un aviso arriba diciéndolo. Es el precio de que las escrituras
exijan un token verificado por el servidor; antes el login se comprobaba en el propio
teléfono, que es justo lo que lo hacía débil.

El cliente sí sigue funcionando sin internet: ve la carta guardada y su pedido queda
en cola hasta que haya señal.

## Agregar más personal

Desde el panel de Supabase: **Authentication → Users → Add user**. Pon un correo con el
mismo formato (`nombre@cafeteria.local`), marca el correo como confirmado y, en
*User metadata*, añade:

```json
{ "usuario": "MARIA", "rol": "trabajador" }
```

Esa persona entrará escribiendo `MARIA` y su clave. Para quitarle el acceso, bórrala
desde esa misma pantalla; la contraseña del dueño no cambia.

> Nota: hoy cualquier usuario autenticado tiene acceso completo al panel. Si quieres que
> un trabajador solo pueda tocar pedidos y disponibilidad, hay que repartir las políticas
> por rol leyendo `auth.jwt()`; está sin hacer a propósito, porque ahora mismo hay un
> solo usuario.

## Si algo se filtra

- **La clave pública:** no hay que hacer nada, está diseñada para ser pública.
- **La contraseña de ADMIN:** cámbiala desde Ajustes → Cambiar mi contraseña, o desde el
  panel de Supabase. Las sesiones viejas caducan en una hora.
- **La clave `service_role`:** rótala de inmediato en Supabase → Settings → API.
