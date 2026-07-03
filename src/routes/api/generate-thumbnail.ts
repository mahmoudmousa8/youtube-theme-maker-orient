import { createFileRoute } from "@tanstack/react-router";

type Body = {
  imageBase64: string; // portrait
  mimeType?: string;
  title: string;
  style: string;
  companyLogoBase64?: string; // top-right
  sheikhLogoBase64?: string;  // top-left
  sheikhName?: string; // small caption near sheikh logo
  paletteIndex?: number; // when set, forces a fixed palette (unified design)
  layoutIndex?: number;  // when set, forces a fixed layout (unified design)
};


const STYLE_PROMPTS: Record<string, string> = {
  islamic:
    "YouTube Arabic Islamic religious thumbnail, 16:9, deeply spiritual REVERENT and SOLEMN atmosphere (خشوع ووقار), cinematic mosque interior / Kaaba-inspired / Madinah / desert-at-dawn background with soft warm golden divine light rays from above, silhouettes of minarets and domes, subtle Islamic geometric arabesque and Kufi motifs as background texture, muted warm sacred palette ONLY (deep midnight navy, warm sepia brown, dark forest green, aged parchment cream, antique gold, off-white), night sky with faint crescent or stars, scholar/reciter portrait respectfully and softly lit, dignified serious mood, incense-like soft golden mist. STRICTLY FORBIDDEN in the Islamic style: bright pink, hot pink, magenta, neon cyan, electric purple, neon green, hot orange, candy colors, playful cartoon colors, saturated party colors, disco lighting, any flashy loud vibe. NO crosses, NO idols, NO figurative religious symbols other than Islamic ones, NO women unless the source photo is a woman, NO music instruments. Feel must be respectful, calm, awe-inspiring — like a Quran recitation cover, not entertainment.",

  drama:
    "Cinematic Arabic drama YouTube thumbnail, 16:9, moody dark background, dramatic rim lighting on the subject placed on the right, huge bold Arabic title on the left in white and red, shattered glass and smoke accents, hyper contrast, film grain, professional viral thumbnail.",
  news:
    "Breaking news style Arabic YouTube thumbnail, 16:9, red and black background with subtle world map, urgent bold white Arabic title on the left with yellow underline, subject portrait on the right with strong side lighting, high contrast, professional viral news thumbnail.",
  motivational:
    "Motivational Arabic YouTube thumbnail, 16:9, golden sunrise cinematic background, inspiring atmosphere, portrait on the right looking forward, huge bold Arabic title on the left in white and gold with glow, subtle light rays, sharp cinematic details.",
  mystery:
    "Mystery and suspense Arabic YouTube thumbnail, 16:9, dark blue and black background with fog, subject silhouetted on the right with a single warm rim light, giant bold Arabic title on the left in white with a red drop shadow, question mark motif, cinematic viral thumbnail.",
};

export const Route = createFileRoute("/api/generate-thumbnail")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Body;
          const { imageBase64, title, style } = body;
          if (!imageBase64 || !title) {
            return new Response(
              JSON.stringify({ error: "imageBase64 and title are required" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) {
            return new Response(
              JSON.stringify({ error: "Missing LOVABLE_API_KEY" }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          const basePrompt =
            STYLE_PROMPTS[style] ?? STYLE_PROMPTS.islamic;

          // Randomize color palette + layout/design so every thumbnail feels unique
          const PALETTES = [
            { name: "gold on deep black", main: "rich golden yellow (#FFC93C)", accent: "burning red (#E63946)", stroke: "deep black" },
            { name: "crimson red on charcoal", main: "vivid crimson red (#FF2E2E)", accent: "bright white", stroke: "black" },
            { name: "cyan electric on navy", main: "electric cyan (#00E5FF)", accent: "hot pink (#FF3D8B)", stroke: "midnight navy" },
            { name: "emerald on forest black", main: "emerald green (#00E676)", accent: "gold (#FFD54F)", stroke: "black" },
            { name: "royal purple on black", main: "royal purple (#7B2FF7)", accent: "magenta (#FF2EC4)", stroke: "black" },
            { name: "orange fire on dark", main: "bright orange (#FF6B00)", accent: "yellow (#FFD400)", stroke: "black" },
            { name: "ice white on blood red", main: "pure white", accent: "blood red (#B00020)", stroke: "black" },
            { name: "turquoise on obsidian", main: "turquoise (#1DE9B6)", accent: "coral (#FF7A59)", stroke: "black" },
            { name: "hot pink on black", main: "hot pink (#FF1F8F)", accent: "cyan (#22D3EE)", stroke: "black" },
            { name: "silver + gold luxury", main: "polished silver white", accent: "luxury gold (#D4AF37)", stroke: "black" },
          ];

          const LAYOUTS = [
            "Left half title, right half portrait; huge diagonal brush-stroke banner behind the text; light rays coming from behind the person.",
            "Portrait on the right isolated with a strong colored rim light; title on the left inside a torn/ripped paper cutout shape.",
            "Portrait centered slightly right with a big circular spotlight halo; title wraps on the left in a stacked 3-line composition with alternating word colors.",
            "Portrait bottom-right, title top-left in a bold slanted banner; explosive particle burst behind the person; heavy vignette.",
            "Split-screen composition: left side flat colored panel with the title, right side cinematic portrait; a jagged lightning-shaped divider between them.",
            "Portrait on the right with dramatic smoke and embers; title on the left with the most important word MUCH LARGER than the rest, other words smaller stacked above/below.",
            "Cinematic wide shot: portrait on the right, title on the left inside a bold geometric shape (hexagon or arrow) with an outlined stroke.",
            "Magazine-cover feel: portrait bleeding to the edge on the right, title on the left in a mixed-weight layout — one word in a script/serif style highlight, the rest in bold sans.",
          ];

          // Islamic style uses a strictly reverent muted palette (no pink/neon/candy colors)
          const ISLAMIC_PALETTES = [
            { name: "antique gold on midnight navy", main: "antique gold (#D4AF37)", accent: "warm cream (#F5E6C8)", stroke: "deep black" },
            { name: "warm gold on charcoal black", main: "warm gold (#E0B84A)", accent: "off-white (#F2ECD8)", stroke: "black" },
            { name: "cream white on deep emerald", main: "aged parchment cream (#F2ECD8)", accent: "antique gold (#C9A24B)", stroke: "black" },
            { name: "sepia gold on dark brown", main: "soft sepia gold (#C9A24B)", accent: "ivory (#EFE6D2)", stroke: "dark brown (#1E1206)" },
            { name: "pure white on forest green", main: "clean white", accent: "antique gold (#C9A24B)", stroke: "black" },
            { name: "gold on obsidian black", main: "burnished gold (#B8860B)", accent: "cream (#EFE6D2)", stroke: "black" },
          ];
          const isIslamic = (style ?? "islamic") === "islamic";
          const paletteList = isIslamic ? ISLAMIC_PALETTES : PALETTES;
          const pIdx =
            typeof body.paletteIndex === "number"
              ? ((body.paletteIndex % paletteList.length) + paletteList.length) % paletteList.length
              : Math.floor(Math.random() * paletteList.length);
          const lIdx =
            typeof body.layoutIndex === "number"
              ? ((body.layoutIndex % LAYOUTS.length) + LAYOUTS.length) % LAYOUTS.length
              : Math.floor(Math.random() * LAYOUTS.length);
          const palette = paletteList[pIdx];
          const layout = LAYOUTS[lIdx];


          const hasCompany = !!body.companyLogoBase64;
          const hasSheikh = !!body.sheikhLogoBase64;
          const sheikhName = (body.sheikhName ?? "").trim();

          const logoInstructions = `
7) LOGOS PLACEMENT (STRICT — ZERO TOLERANCE FOR ERRORS):
${hasCompany ? "- The SECOND attached image is the COMPANY logo. Copy it PIXEL-FOR-PIXEL as-is and paste it at the TOP-RIGHT corner with a ~3% margin, sized ~12% of thumbnail width. ABSOLUTELY DO NOT: redraw it, restyle it, change its colors, change or translate its text/letters, add or remove any element, mirror it, rotate it, crop it, blur it, add effects on top of it, or place anything over it. Keep its original transparent background clean (no colored box behind it). It must look identical to the source file." : "- No company logo provided — do NOT invent, draw, or hallucinate any company logo anywhere in the image."}
${hasSheikh ? "- The THIRD attached image is the SHEIKH/READER logo. Copy it PIXEL-FOR-PIXEL as-is and paste it at the TOP-LEFT corner with a ~3% margin, sized ~12% of thumbnail width. Same strict rules: do NOT redraw, restyle, recolor, change its text/letters, mirror, rotate, crop, or add effects. Keep it exactly as provided." : "- No sheikh logo provided — do NOT invent, draw, or hallucinate any logo on the left side."}
- Both logos must sit on the topmost layer, fully visible, never behind the person, text, particles, or graphic accents. Add ONLY a very subtle soft drop shadow for readability — nothing else. Never duplicate them, never move them elsewhere, never write extra text next to them (except the sheikh name label described below if provided).
${sheikhName ? `8) SHEIKH/READER NAME NAMEPLATE (MANDATORY, PROFESSIONAL PLACEMENT):
   - Render EXACTLY this Arabic name, character-for-character, with 100% correct Arabic spelling and RTL letter joining — NO gibberish, NO Latin letters, NO extra words, NO honorific added, NO translation: «${sheikhName}»
   - Place it as an elegant professional NAMEPLATE at the BOTTOM-LEFT corner of the thumbnail (with a ~3% margin from the bottom and left edges). Design it as a sleek horizontal pill/banner: a semi-transparent dark bar (or gold-outlined bar matching the palette) with a thin accent underline or a small decorative Islamic ornament divider on its side.
   - Font: clean bold modern Arabic (Cairo / Tajawal style), height around 5-6% of thumbnail height, in white or gold with a subtle shadow, perfectly readable.
   - It MUST NOT overlap the face, MUST NOT overlap the main title, MUST NOT be near the top logos, and MUST be clearly smaller than the main title. Keep it tidy, aligned, and truly professional — like a TV lower-third for a guest speaker.` : "8) No sheikh/reader name provided — do NOT write any name text anywhere in the image."}`;



          const prompt = `${basePrompt}

CRITICAL RULES — MUST FOLLOW EXACTLY:
1) The FIRST attached image is the person photo. Use it as the main subject. Preserve the face EXACTLY as-is — do NOT change, distort, morph, age, beautify, or alter facial features, skin tone, beard, hair, or expression. No deformities, no extra fingers, no extra limbs, no duplicated faces, no melted features, anatomically correct.
2) LAYOUT (use this exact composition for THIS thumbnail): ${layout}
3) TITLE TEXT — HIGHEST PRIORITY, ZERO TOLERANCE FOR ERRORS. Render the following Arabic sentence on the thumbnail EXACTLY letter-for-letter, word-for-word, in perfect standard Arabic with correct right-to-left joining and correct dot placement on every letter. The rendered text MUST match this reference string 100% — same words, same order, same spelling, same spacing, nothing added, nothing removed, nothing translated, nothing shortened, no synonyms, no paraphrase, no honorifics, no channel name, no watermark, no captions, no Latin letters, no numbers unless present in the reference, no random Arabic-looking squiggles.

Reference title (copy this exact string of ${[...title].length} characters):
«${title}»

Character-by-character breakdown you MUST reproduce in order (right-to-left reading, space = مسافة):
${[...title].map((ch, i) => `${i + 1}. ${ch === " " ? "[مسافة]" : ch}`).join(" | ")}

Before drawing the text, mentally verify each letter matches the reference. If any word looks wrong while drawing, re-draw it. It is FAR better to keep the letters simple and correct than to make them fancy but misspelled. Do not write the word "العنوان" or "title" or quotation marks around it.


4) COLOR PALETTE for THIS thumbnail (use exactly this scheme — do NOT default to red/yellow every time): "${palette.name}". Title main color = ${palette.main}. Secondary/accent color for one highlighted keyword or underline = ${palette.accent}. Outline/stroke around letters = ${palette.stroke}. Vary word colors within the title (mix main + accent across different words) so the title feels professional and designed, not monochrome. Background palette must harmonize with this scheme, not fight it.
5) Typography: HUGE bold sharp modern Arabic display font (similar to Cairo / Tajawal / Arabic Black), thick strokes, 3D depth, strong drop shadow and outer glow that match the palette above. Professional graphic-designer quality — kerning, alignment, and hierarchy must look hand-crafted, not auto-generated.
6) Visuals: ultra sharp 8K details, cinematic rim lighting, volumetric god rays, layered depth, dust particles, rich color grading, film grain, extreme contrast, viral scroll-stopping energy. Aspect ratio strictly 16:9. Every generation should look DIFFERENT — different composition, different color emphasis, different graphic accents (brush strokes, torn paper, geometric shapes, particles, light streaks). Avoid a repetitive template look.
${logoInstructions}`;


          const toDataUrl = (b64: string) =>
            b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`;

          const dataUrl = imageBase64.startsWith("data:")
            ? imageBase64
            : `data:${body.mimeType ?? "image/png"};base64,${imageBase64}`;

          const content: Array<
            { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
          > = [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ];
          if (hasCompany) {
            content.push({
              type: "image_url",
              image_url: { url: toDataUrl(body.companyLogoBase64!) },
            });
          }
          if (hasSheikh) {
            content.push({
              type: "image_url",
              image_url: { url: toDataUrl(body.sheikhLogoBase64!) },
            });
          }

          const callUpstream = () =>
            fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-3-pro-image",
                messages: [{ role: "user", content }],
                modalities: ["image", "text"],
              }),
            });

          let b64: string | undefined;
          let lastError = "";
          for (let attempt = 0; attempt < 2 && !b64; attempt++) {
            try {
              const upstream = await callUpstream();
              if (!upstream.ok) {
                lastError = (await upstream.text()) || `Upstream ${upstream.status}`;
                // 429/5xx: retry once; other codes: stop
                if (upstream.status !== 429 && upstream.status < 500) break;
                continue;
              }
              const json = (await upstream.json()) as {
                data?: Array<{ b64_json?: string }>;
              };
              b64 = json.data?.[0]?.b64_json;
              if (!b64) lastError = "الموديل لم يُرجع صورة، حاول مرة أخرى.";
            } catch (e) {
              lastError = e instanceof Error ? e.message : "Network error";
            }
          }

          if (!b64) {
            // Return 200 with error field so the client shows a friendly message
            // instead of a hard 502 that trips the route error boundary.
            return new Response(
              JSON.stringify({ error: lastError || "فشل التوليد" }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }


          return new Response(
            JSON.stringify({ image: `data:image/png;base64,${b64}` }),
            { status: 200, headers: { "Content-Type": "application/json" } },
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
