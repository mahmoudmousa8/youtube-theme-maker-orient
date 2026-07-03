import { createFileRoute } from "@tanstack/react-router";

type Body = {
  style: string;
  title: string; // Used to customize background elements
};

const BACKGROUND_PROMPTS: Record<string, string> = {
  islamic:
    "A high-quality 16:9 cinematic background for an Islamic video thumbnail. Beautiful mosque interior with soft warm golden light rays, domes, silhouettes of minarets, desert-at-dawn sky, reverent solemn atmosphere, deep midnight navy and antique gold color palette, 8k resolution, photorealistic, no people, no text, no logos.",
  drama:
    "A dramatic cinematic movie-style 16:9 background. Moody dark background with smoke, subtle embers, and shattered glass accents, high contrast, dramatic rim lighting, dark charcoal and deep crimson colors, 8k resolution, no people, no text, no logos.",
  news:
    "A professional 16:9 news studio background. Urgent red and black theme, digital world map pattern in the background, neon glass accents, cinematic side lighting, 8k resolution, no people, no text, no logos.",
  motivational:
    "An inspiring 16:9 landscape background. Cinematic golden sunrise over mountains and clouds, soft warm light rays, optimistic and clean atmosphere, warm gold and sky blue colors, 8k resolution, no people, no text, no logos.",
  mystery:
    "A mysterious and suspenseful 16:9 dark background. Dark blue and black theme with thick fog, single spotlight beam from above, cinematic dark moody atmosphere, 8k resolution, no people, no text, no logos.",
};

export const Route = createFileRoute("/api/generate-thumbnail")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Body;
          const { style, title } = body;

          const apiKey = process.env.GEMINI_API_KEY || "AIzaSyBVvVNLmt9I8xDiRqrZinnMktPcfXDJDS0";
          if (!apiKey) {
            return new Response(
              JSON.stringify({ error: "Missing GEMINI_API_KEY" }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }

          const basePrompt = BACKGROUND_PROMPTS[style] ?? BACKGROUND_PROMPTS.islamic;
          // Add some customization based on the title keywords to make each background unique
          const prompt = `${basePrompt} Keywords related to background theme: ${title.slice(0, 50)}.`;

          const upstream = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                instances: [{ prompt }],
                parameters: {
                  sampleCount: 1,
                  aspectRatio: "16:9",
                  outputMimeType: "image/png",
                },
              }),
            }
          );

          if (!upstream.ok) {
            const errorText = await upstream.text();
            return new Response(
              JSON.stringify({ error: `Google AI Studio error: ${errorText || upstream.status}` }),
              { status: 502, headers: { "Content-Type": "application/json" } }
            );
          }

          const json = (await upstream.json()) as {
            predictions?: Array<{ bytesBase64Encoded?: string }>;
            error?: { message?: string };
          };

          const b64 = json.predictions?.[0]?.bytesBase64Encoded;
          if (!b64) {
            return new Response(
              JSON.stringify({ error: json.error?.message || "Failed to generate background image." }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }

          return new Response(
            JSON.stringify({ image: `data:image/png;base64,${b64}` }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
