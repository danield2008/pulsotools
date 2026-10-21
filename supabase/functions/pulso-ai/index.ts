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

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json({ error: "La IA aún no está configurada en el servidor." }, 503);

  let body: { tool?: string; prompt?: string; style?: string; topic?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Solicitud no válida." }, 400);
  }

  const allowedTools = new Set(["nombres", "bio", "videos", "titulos", "mejorar"]);
  const tool = typeof body.tool === "string" ? body.tool : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const style = typeof body.style === "string" ? body.style.trim() : "creativo";

  if (!allowedTools.has(tool)) return json({ error: "Herramienta no permitida." }, 400);
  if (prompt.length > 1200 || topic.length > 300 || style.length > 80) {
    return json({ error: "El texto es demasiado largo." }, 400);
  }
  if (!prompt && !topic) return json({ error: "Escribe un tema o una instrucción." }, 400);

  const taskByTool: Record<string, string> = {
    nombres: "Propón 10 nombres memorables para el proyecto descrito. Evita afirmar que están libres como marca o dominio.",
    bio: "Crea 5 biografías breves para redes sociales, distintas entre sí y listas para personalizar.",
    videos: "Propón 5 ideas de vídeos cortos con gancho inicial, desarrollo y llamada a la acción.",
    titulos: "Propón 10 títulos claros y atractivos, sin prometer resultados falsos ni usar clickbait engañoso.",
    mejorar: "Mejora el texto del usuario conservando su intención. Ofrece una versión principal y dos alternativas."
  };

  const input = [
    "Eres el asistente creativo de PulsoTools. Responde en español natural, útil y concreto.",
    taskByTool[tool],
    `Estilo solicitado: ${style}`,
    topic ? `Tema: ${topic}` : "",
    prompt ? `Instrucciones o texto del usuario: ${prompt}` : "",
    "No inventes datos verificables. Usa listas legibles y evita introducciones largas."
  ].filter(Boolean).join("\n\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input,
        max_output_tokens: 650,
        store: false,
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("OpenAI request failed", response.status, detail.slice(0, 500));
      return json({ error: response.status === 429 ? "Límite de uso alcanzado. Inténtalo más tarde." : "El servicio de IA no está disponible ahora." }, response.status === 429 ? 429 : 502);
    }
    const data = await response.json();
    const text = (data.output ?? [])
      .flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content ?? [])
      .filter((part: { type?: string }) => part.type === "output_text")
      .map((part: { text?: string }) => part.text ?? "")
      .join("\n")
      .trim();
    if (!text) return json({ error: "La IA no devolvió contenido. Prueba otra vez." }, 502);
    return json({ text });
  } catch (error) {
    console.error("AI function error", error);
    return json({ error: "No se pudo conectar con el servicio de IA." }, 502);
  }
});
