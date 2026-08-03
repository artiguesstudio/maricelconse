# Maricel Conse · Sitio y backoffice

Web responsive para los servicios, ebooks y membresía de Maricel Conse. Los HTML originales fueron reunidos en una sola aplicación con autenticación, roles y contenido administrable mediante Supabase.

## Abrir el proyecto en Visual Studio Code

Este proyecto no se abre con **Live Server**: usa una aplicación Next.js/Vinext porque el login, el backoffice y la base de datos necesitan un servidor.

1. Abrí esta carpeta completa en Visual Studio Code.
2. Copiá `.env.example` como `.env.local` y completá la clave pública de Supabase.
3. En PowerShell ejecutá `npm.cmd install` la primera vez.
4. Ejecutá `npm.cmd run dev`.
5. Abrí `http://localhost:3000`.

En equipos donde PowerShell bloquea `npm.ps1`, usar `npm.cmd` evita cambiar la política de seguridad de Windows.

## Direcciones principales

- Web pública: `http://localhost:3000`
- Ingreso por código de un solo uso: `http://localhost:3000/login`
- Área de socias: `http://localhost:3000/mi-espacio`
- Backoffice: `http://localhost:3000/admin`

Las cuentas administradoras se definen en la migración mediante hashes de email, para no publicar las direcciones en el repositorio. Los demás usuarios comienzan con rol `member` y membresía `inactive`.

## Supabase

El proyecto remoto usa el ref `wdbnyzzvlgfubtrtalhh`. La carpeta `supabase/migrations/` contiene tablas, contenido inicial, roles y políticas RLS.

Para vincular y aplicar cambios sin compartir claves privadas:

```powershell
npm.cmd run supabase:login
npm.cmd run supabase:link
npm.cmd run supabase:push
```

La autenticación debe permitir estas redirecciones:

- `http://localhost:3000/auth/callback`
- `https://www.maricelconse.com.ar/auth/callback`
- `https://maricelconse.com.ar/auth/callback`

## Cloudflare

El Worker se llama `maricelconse` y está configurado en `wrangler.jsonc`. En Cloudflare Workers Builds:

- rama de producción: `main`
- comando de build: `npm run build`
- comando de deploy: `npx wrangler deploy`
- directorio raíz: `/`

`.env.production` contiene solamente la URL y la clave pública del navegador para que Cloudflare pueda compilar desde GitHub. Nunca agregar una clave `service_role` al repositorio. Si la clave pública se rota, también se puede reemplazar mediante las variables de build `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Estructura

- `app/`: páginas, estilos, autenticación y backoffice.
- `db/content.ts`: lectura y escritura de contenidos en Supabase.
- `lib/supabase/`: clientes de navegador, servidor y renovación de sesión.
- `supabase/migrations/`: esquema PostgreSQL y reglas de seguridad.
- `public/images/`: fotos, portadas y testimonios recuperados de los HTML originales.
- `work/legacy-html/`: copia local ignorada de los HTML originales.

## Comandos útiles

- `npm.cmd run dev`: desarrollo local.
- `npm.cmd run typecheck`: comprueba TypeScript.
- `npm.cmd run lint`: comprueba estilo y errores comunes.
- `npm.cmd run build`: compilación final.
- `npm.cmd run preview`: vista previa en el runtime de Cloudflare.
- `npm.cmd run deploy`: compila y publica con Vinext/Wrangler.

Mercado Pago todavía no está conectado. La siguiente etapa podrá actualizar `membership_status` según el estado de cada suscripción.
