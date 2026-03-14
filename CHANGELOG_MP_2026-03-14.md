# Cambios aplicados — checkout / webhook / upgrades

## Frontend
- Se eliminó la redirección directa hardcodeada a Mercado Pago desde:
  - `academia360/register.js`
  - `academia360/onboarding.js`
  - `academia360/app.js`
  - `academia360/index.html`
- Todo el flujo de alta y upgrade ahora pasa por `mp-checkout`.
- Se mejoró la resolución del plan activo en `app.js` usando `current_plan_slug` como fuente prioritaria.
- Se corrigieron redirects de auth para instalaciones bajo `/academia360`.
- Se agregó configuración base en `config.js`:
  - `APP_BASE_PATH`
  - `SITE_ORIGIN`

## Edge Functions incluidas en el proyecto
- `supabase/functions/mp-checkout/index.ts`
- `supabase/functions/mp-webhook/index.ts`

## Lógica nueva
- Alta nueva: crea checkout y deja rastro coherente en `profiles` + `user_plan`.
- Upgrade Basic → Mid / Pro y Mid → Pro:
  - mantiene el plan activo actual hasta confirmación del nuevo pago.
  - al confirmarse el nuevo pago, el webhook promueve el nuevo plan.
  - intenta cancelar la suscripción anterior en Mercado Pago.
  - si el intento de upgrade falla o se cancela, conserva el plan viejo activo.

## Deploy sugerido
1. Subir los cambios del frontend.
2. Reemplazar el contenido de:
   - `mp-checkout`
   - `mp-webhook`
3. Confirmar variables de entorno en Supabase Functions:
   - `MP_ACCESS_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SITE_ORIGIN`
   - `SITE_BASE_PATH`
4. Probar:
   - alta nueva basic
   - alta nueva mid/pro
   - upgrade basic → mid
   - upgrade mid → pro
   - cancelación o abandono de upgrade

## Nota
El flujo de upgrade asume que el reemplazo es inmediato al confirmarse el nuevo pago.
