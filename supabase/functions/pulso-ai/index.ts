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
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: contents }] }], generationConfig: { maxOutputTokens: 700, temperature: 0.8 } })
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("Gemini request failed", response.status, detail.slice(0, 400));
      return json({ error: response.status === 429 ? "Has alcanzado el límite gratuito. Prueba más tarde." : "El servicio de IA no está disponible ahora." }, response.status === 429 ? 429 : 502);
    }
    const data = await response.json();
    const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: {text?:string}) => p.text ?? "").join("\n").trim();
    if (!text) return json({ error: "La IA no devolvió contenido. Prueba otra vez." }, 502);
    return json({ text });
  } catch (e) {
    console.error("Gemini function error", e);
    return json({ error: "No se pudo conectar con el servicio de IA." }, 502);
  }
});