import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://danield2008.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "Falta configurar GEMINI_API_KEY en los secretos de Supabase." }, 503);

  let body: { tool?: string; prompt?: string; style?: string; topic?: string };
  try { body = await req.json(); } catch { return json({ error: "Solicitud no válida." }, 400); }

  const allowed = new Set(["nombres", "bio", "videos", "titulos", "mejorar"]);
  const tool = typeof body.tool === "string" ? body.tool : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const style = typeof body.style === "string" ? body.style.trim() : "creativo";
  if (!allowed.has(tool)) return json({ error: "Herramienta no permitida." }, 400);
  if (prompt.length > 1200 || topic.length > 300 || style.length > 80) return json({ error: "El texto es demasiado largo." }, 400);
  if (!prompt && !topic) return json({ error: "Escribe un tema o una instrucción." }, 400);

  const tasks: Record<string,string> = {
    nombres: "Propón 10 nombres memorables para el proyecto. Explica brevemente algunos. No afirmes que marcas o dominios estén libres.",
    bio: "Crea 5 biografías breves para redes sociales, distintas y listas para personalizar.",
    videos: "Propón 5 ideas de vídeos cortos con gancho inicial, desarrollo y llamada a la acción.",
    titulos: "Propón 10 títulos claros y atractivos, sin promesas falsas ni clickbait engañoso.",
    mejorar: "Mejora el texto conservando su intención. Ofrece una versión principal y dos alternativas."
  };
  const contents = [
    "Eres el asistente creativo de PulsoTools. Responde en español natural, útil y concreto.",
    tasks[tool], "Estilo solicitado: " + style,
    topic ? "Tema: " + topic : "", prompt ? "Instrucciones o texto del usuario: " + prompt : "",
    "No inventes datos verificables. Usa listas legibles y evita introducciones largas."
  ].filter(Boolean).join("\n\n");

  try {
    // Reintentar y usar modelos alternativos si Google devuelve saturación.
    const models = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];
    let lastStatus = 502;
    let lastDetail = "";
    for (const model of models) {
      let response: Response | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({ contents: [{ parts: [{ text: contents }] }], generationConfig: { maxOutputTokens: 700, temperature: 0.8 } })
        });
        if (response.ok) break;
        lastStatus = response.status;
        lastDetail = await response.text();
        console.error("Gemini model failed", model, "attempt", attempt + 1, response.status, lastDetail.slice(0, 250));
        if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 1) break;
        await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
      }
      if (response?.ok) {
        const data = await response.json();
        const resultText = (data.candidates?.[0]?.content?.parts ?? []).map((p: {text?:string}) => p.text ?? "").join("\n").trim();
        if (resultText) return json({ text: resultText });
        lastDetail = "El modelo devolvió una respuesta vacía.";
      }
      if (![429, 500, 502, 503, 504].includes(lastStatus)) break;
    }
    if (lastStatus === 429) return json({ error: "Google ha alcanzado el límite temporal de solicitudes gratuitas. Espera un minuto y prueba otra vez." }, 429);
    console.error("All Gemini models failed", lastStatus, lastDetail.slice(0, 300));
    return json({ error: "Los modelos de IA están temporalmente saturados. Pulsa Generar de nuevo en unos segundos." }, 503);
  } catch (e) {
    console.error("Gemini function error", e);
    return json({ error: "No se pudo conectar con el servicio de IA." }, 502);
  }
});