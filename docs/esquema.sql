-- ═══════════════════════════════════════════════════════════════
--  Esquema completo de la base de datos (Supabase / PostgreSQL).
--  Ejecútalo entero en el SQL Editor para levantar otro proyecto
--  desde cero. Al final crea el usuario ADMIN.
-- ═══════════════════════════════════════════════════════════════

-- ── TABLAS ──
create table if not exists categorias (
  id      bigserial primary key,
  nombre  text not null unique,
  orden   int  not null default 0
);

create table if not exists productos (
  id           bigserial primary key,
  nombre       text    not null,
  descripcion  text    default '',
  precio       numeric not null default 0,   -- siempre en CUP
  precio2      numeric default 0,            -- referencia en otra moneda
  categoria    text    not null default '',
  emoji        text    default '☕',
  disponible   boolean not null default true,
  orden        int     not null default 0,
  img_v        int     not null default 0,   -- sube al cambiar la foto; invalida la caché del cliente
  creado       timestamptz default now()
);

-- Las fotos van aparte: así la carta se descarga sin arrastrarlas.
create table if not exists producto_img (
  producto_id bigint primary key references productos(id) on delete cascade,
  data        text not null                  -- data URI (JPEG reducido a 420 px)
);

create table if not exists mesas (
  n      int primary key,
  nombre text not null
);

create table if not exists config (
  id    int primary key default 1,
  datos jsonb not null default '{}'::jsonb,
  check (id = 1)
);

create table if not exists pedidos (
  id           bigserial primary key,
  mesa         text    not null,
  estado       text    not null default 'nuevo',   -- nuevo | preparando | listo | entregado
  dividido     boolean not null default false,
  items        jsonb   not null default '[]'::jsonb,
  cuentas      jsonb   not null default '[]'::jsonb,
  total        numeric not null default 0,
  cliente_uid  text    default '',
  creado       timestamptz not null default now(),
  actualizado  timestamptz not null default now()
);
create index if not exists pedidos_creado_idx on pedidos (creado desc);

create or replace function touch_pedido() returns trigger
language plpgsql as $$ begin new.actualizado = now(); return new; end; $$;
drop trigger if exists trg_touch_pedido on pedidos;
create trigger trg_touch_pedido before update on pedidos
for each row execute function touch_pedido();

-- ── SEGURIDAD A NIVEL DE FILA ──
-- El cliente (rol anon) solo puede LEER la carta y CREAR su pedido.
-- Todo lo demás exige haber entrado al panel (rol authenticated).
alter table categorias   enable row level security;
alter table productos    enable row level security;
alter table producto_img enable row level security;
alter table mesas        enable row level security;
alter table config       enable row level security;
alter table pedidos      enable row level security;

create policy lee_cat    on categorias   for select to anon, authenticated using (true);
create policy lee_prod   on productos    for select to anon, authenticated using (true);
create policy lee_img    on producto_img for select to anon, authenticated using (true);
create policy lee_mesas  on mesas        for select to anon, authenticated using (true);
create policy lee_config on config       for select to anon, authenticated using (true);

create policy adm_cat    on categorias   for all to authenticated using (true) with check (true);
create policy adm_prod   on productos    for all to authenticated using (true) with check (true);
create policy adm_img    on producto_img for all to authenticated using (true) with check (true);
create policy adm_mesas  on mesas        for all to authenticated using (true) with check (true);
create policy adm_config on config       for all to authenticated using (true) with check (true);

-- El cliente crea su pedido, pero no puede leerlo, cambiarlo ni borrarlo.
-- El WITH CHECK impide además que mande basura o se marque solo como entregado.
create policy crea_ped on pedidos for insert to anon, authenticated
  with check (
    estado = 'nuevo'
    and total >= 0 and total <= 10000000
    and length(mesa) between 1 and 12
    and jsonb_array_length(items) between 1 and 60
    and pg_column_size(items) + pg_column_size(cuentas) < 20000
  );
create policy adm_ped on pedidos for all to authenticated using (true) with check (true);

revoke update, delete on pedidos from anon;
revoke insert, update, delete on categorias, productos, producto_img, mesas, config from anon;

-- ── DATOS MÍNIMOS ──
insert into categorias(nombre,orden) values
 ('Cafés Clásicos',1),('Para Brindar',2),('Bebidas Frías',3),
 ('Dulces',4),('Bocaditos',5),('Desayuno',6)
on conflict (nombre) do nothing;

insert into mesas(n,nombre) select g, 'Mesa '||g from generate_series(1,8) g
on conflict (n) do nothing;

insert into config(id,datos) values (1, jsonb_build_object(
 'nombre','Mi Cafetería','emoji','☕',
 'dir','Pon aquí tu dirección','hora','8:00 AM - 8:00 PM',
 'abre','08:00','cierra','20:00',
 'wa','5350000000','tel','5350000000',
 'cerrado','Cerrado por hoy. ¡Vuelve mañana!','forzarCerrado',false,
 'tasa',420,'moneda2','USD','baseURL','https://ejemplo.com'))
on conflict (id) do nothing;

-- ── USUARIO DEL PANEL ──
-- El panel entra con el usuario ADMIN; por detrás es el correo
-- admin@cafeteria.local en Supabase Auth. Cambia la clave al entrar.
with nuevo as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
    'authenticated', 'authenticated',
    'admin@cafeteria.local', extensions.crypt('abcdefg1', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"usuario":"ADMIN","rol":"dueño"}'::jsonb,
    '', '', '', ''
  )
  on conflict (email) do nothing
  returning id, email
)
insert into auth.identities (provider_id, user_id, identity_data, provider,
                             last_sign_in_at, created_at, updated_at)
select id, id,
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       'email', now(), now(), now()
from nuevo;
