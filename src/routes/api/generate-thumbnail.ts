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

          // List of Gemini-native image generation models to try in sequence
          const models = [
            "gemini-3-pro-image-preview",
            "gemini-3.1-flash-image",
            "gemini-3-pro-image",
            "gemini-2.5-flash-image"
          ];

          let base64Image = "";
          let lastError = "";

          for (const model of models) {
            try {
              const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
              const payload = {
                contents: [
                  {
                    role: "user",
                    parts: [
                      {
                        text: prompt
                      }
                    ]
                  }
                ],
                generationConfig: {
                  responseModalities: ["IMAGE"],
                  imageConfig: {
                    aspectRatio: "16:9",
                    imageSize: "1K"
                  }
                }
              };

              const response = await fetch(url, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
              });

              if (response.ok) {
                const resJson = await response.json();
                const b64 = resJson.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                if (b64) {
                  base64Image = b64;
                  break; // Found a working model, stop checking
                }
              } else {
                const errText = await response.text();
                lastError += `[${model}]: ${errText} | `;
              }
            } catch (e) {
              const errMsg = e instanceof Error ? e.message : String(e);
              lastError += `[${model} error]: ${errMsg} | `;
            }
          }

          // If all native Gemini image models failed, try legacy imagen-3.0-generate-002 as a final fallback
          if (!base64Image) {
            try {
              const response = await fetch(
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

              if (response.ok) {
                const json = await response.json();
                const b64 = json.predictions?.[0]?.bytesBase64Encoded;
                if (b64) {
                  base64Image = b64;
                }
              } else {
                const errText = await response.text();
                lastError += `[imagen-3.0]: ${errText}`;
              }
            } catch (e) {
              const errMsg = e instanceof Error ? e.message : String(e);
              lastError += `[imagen-3.0 error]: ${errMsg}`;
            }
          }

          // If all native Gemini image models and legacy Imagen models failed, try Pollinations.ai as a FREE fallback!
          if (!base64Image) {
            try {
              const encodedPrompt = encodeURIComponent(prompt);
              const pollUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=576&nologo=true&private=true&enhance=false`;

              const pollResponse = await fetch(pollUrl, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
              });

              if (pollResponse.ok) {
                const arrayBuffer = await pollResponse.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                base64Image = buffer.toString("base64");
              } else {
                const errText = await pollResponse.text();
                lastError += ` | [Pollinations]: ${errText}`;
              }
            } catch (e) {
              const errMsg = e instanceof Error ? e.message : String(e);
              lastError += ` | [Pollinations error]: ${errMsg}`;
            }
          }

          if (!base64Image) {
            return new Response(
              JSON.stringify({ error: `All image generation models failed. Errors: ${lastError}` }),
              { status: 502, headers: { "Content-Type": "application/json" } }
            );
          }

          return new Response(
            JSON.stringify({ image: `data:image/png;base64,${base64Image}` }),
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
