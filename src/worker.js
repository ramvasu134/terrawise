/**
 * TerraWise AI Worker
 *
 * Handles AI requests via Cloudflare Workers AI.
 * Input is truncated to MAX_INPUT_CHARS before being sent to the model
 * to avoid the "Oops, your request is too large" error from Workers AI.
 */

const MAX_INPUT_CHARS = 1500;
const AI_MODEL = "@cf/meta/llama-2-7b-chat-int8";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function corsResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
      return corsResponse(JSON.stringify({ error: "Method not allowed" }), 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return corsResponse(JSON.stringify({ error: "Invalid JSON body" }), 400);
    }

    const rawInput = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!rawInput) {
      return corsResponse(
        JSON.stringify({ error: "prompt is required" }),
        400
      );
    }

    // Truncate to stay within the model's context window and avoid
    // "Oops, your request is too large" from Workers AI.
    const truncated = rawInput.length > MAX_INPUT_CHARS;
    const prompt = rawInput.slice(0, MAX_INPUT_CHARS);

    let aiResponse;
    try {
      aiResponse = await env.AI.run(AI_MODEL, { prompt });
    } catch (err) {
      return corsResponse(
        JSON.stringify({ error: "AI model error", detail: err.message }),
        502
      );
    }

    return corsResponse(
      JSON.stringify({
        response: aiResponse.response ?? aiResponse,
        truncated,
        originalLength: rawInput.length,
      })
    );
  },
};
