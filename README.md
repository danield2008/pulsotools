# PulsoTools

Web responsive de herramientas rápidas y generadores creativos. La IA se conecta a través de una Supabase Edge Function; la clave de OpenAI nunca debe ir en GitHub ni en el navegador.

## IA segura: configuración pendiente

Este repositorio incluye el backend en `supabase/functions/pulso-ai/index.ts`. No está desplegado todavía y la interfaz no hará llamadas reales hasta configurar el servidor y conectar los controles del front-end.

1. Crea un proyecto Supabase en el plan Free, revisando sus límites y condiciones actuales.
2. En Supabase, abre **Edge Functions → Secrets** y añade `OPENAI_API_KEY` con tu clave privada. Nunca la subas a GitHub.
3. Despliega la función `pulso-ai` desde la CLI de Supabase.
4. Configura el front-end con el URL de la función y la clave publishable de Supabase. La clave publishable puede aparecer en el navegador; la clave OpenAI no.
5. Añade controles antiabuso (por ejemplo, autenticación, límites por usuario/IP y cuotas). CORS no es una medida de autenticación.
6. Prueba con prompts cortos y configura límites de gasto en el proveedor cuando estén disponibles.

## Costes y límites

GitHub Pages y el plan Free de Supabase pueden permitir comenzar sin pagar dentro de sus límites, pero las llamadas a la API de OpenAI normalmente se facturan por uso y no debe asumirse que una cuenta nueva recibe crédito gratuito. Por tanto, con presupuesto estrictamente de 0 €, la integración quedará preparada pero no generará respuestas reales hasta que haya crédito disponible o se elija un proveedor realmente gratuito.

## Funciones disponibles

La función admite `nombres`, `bio`, `videos`, `titulos` y `mejorar`. Limita el tamaño de la entrada, la salida y los métodos HTTP, y no devuelve la clave al cliente.
