import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  Loader2,
  Upload,
  Download,
  Sparkles,
  ImageIcon,
  DownloadCloud,
  XCircle,
  X,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Thumbnail Generator | مولّد صور مصغرة ليوتيوب" },
      {
        name: "description",
        content:
          "أنشئ عشرات الصور المصغرة الاحترافية ليوتيوب دفعة واحدة بذكاء اصطناعي: ارفع صورتك، أضف قائمة عناوين، وحمّل ثامنيلات درامية 16:9.",
      },
      { property: "og:title", content: "AI Thumbnail Generator" },
      {
        property: "og:description",
        content: "مولّد صور مصغرة احترافية ليوتيوب بالعربية بالذكاء الاصطناعي.",
      },
    ],
  }),
  component: Index,
});

const STYLES = [
  { value: "islamic", label: "ديني / إسلامي" },
  { value: "drama", label: "دراما" },
  { value: "news", label: "أخبار عاجلة" },
  { value: "motivational", label: "تحفيزي" },
  { value: "mystery", label: "غموض وتشويق" },
];

const CONCURRENCY = 3;

type Job = {
  id: string;
  title: string;
  status: "pending" | "loading" | "done" | "error";
  image?: string;
  error?: string;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function slugify(s: string) {
  return s
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .slice(0, 40);
}

async function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function Index() {
  const [titlesText, setTitlesText] = useState("");
  const [style, setStyle] = useState("islamic");
  const [images, setImages] = useState<string[]>([]);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [sheikhLogo, setSheikhLogo] = useState<string | null>(null);
  const [sheikhName, setSheikhName] = useState("");
  const [unifyDesign, setUnifyDesign] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [running, setRunning] = useState(false);
  const cancelRef = useRef({ cancelled: false });
  const fileRef = useRef<HTMLInputElement>(null);
  const companyRef = useRef<HTMLInputElement>(null);
  const sheikhRef = useRef<HTMLInputElement>(null);


  const titles = useMemo(
    () =>
      titlesText
        .split("\n")
        .map((t) => t.trim())
        .filter(Boolean),
    [titlesText],
  );

  const doneCount = jobs.filter((j) => j.status === "done").length;
  const errorCount = jobs.filter((j) => j.status === "error").length;
  const total = jobs.length;

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 8 * 1024 * 1024) {
        toast.error(`${file.name}: أكبر من 8 ميجابايت، تم تجاهلها.`);
        continue;
      }
      const dataUrl = await fileToBase64(file);
      next.push(dataUrl);
    }
    if (next.length > 0) {
      setImages((prev) => [...prev, ...next]);
      toast.success(`تمت إضافة ${next.length} صورة.`);
    }
  };

  const removeImage = (i: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== i));
  };

  const onLogo = async (
    file: File | undefined,
    setter: (v: string | null) => void,
  ) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("اللوجو أكبر من 4 ميجابايت.");
      return;
    }
    const dataUrl = await fileToBase64(file);
    setter(dataUrl);
  };


  const runJob = async (
    job: Job,
    imageBase64: string,
    unified?: { paletteIndex: number; layoutIndex: number },
  ): Promise<Job> => {
    try {
      const res = await fetch("/api/generate-thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          title: job.title,
          style,
          companyLogoBase64: companyLogo || undefined,
          sheikhLogoBase64: sheikhLogo || undefined,
          sheikhName: sheikhName.trim() || undefined,
          paletteIndex: unified?.paletteIndex,
          layoutIndex: unified?.layoutIndex,
        }),
      });

      const data = (await res.json()) as { image?: string; error?: string };
      if (!res.ok || !data.image) {
        return { ...job, status: "error", error: data.error || "فشل التوليد" };
      }
      return { ...job, status: "done", image: data.image };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "خطأ غير متوقع";
      return { ...job, status: "error", error: msg };
    }
  };

  const generate = async () => {
    if (images.length === 0) {
      toast.error("يرجى رفع صورة واحدة على الأقل.");
      return;
    }
    if (titles.length === 0) {
      toast.error("يرجى إضافة عنوان واحد على الأقل.");
      return;
    }
    cancelRef.current.cancelled = false;
    const initial: Job[] = titles.map((title, i) => ({
      id: `${Date.now()}-${i}`,
      title,
      status: "pending",
    }));
    setJobs(initial);
    setRunning(true);

    // When unified, fix the palette+layout once for the whole batch.
    // Range must match the server arrays (10 general palettes / 6 islamic, 8 layouts).
    const unified = unifyDesign
      ? {
          paletteIndex: Math.floor(
            Math.random() * (style === "islamic" ? 6 : 10),
          ),
          layoutIndex: Math.floor(Math.random() * 8),
        }
      : undefined;

    const queue = [...initial];
    let index = 0;

    const worker = async () => {
      while (!cancelRef.current.cancelled) {
        const current = queue[index];
        const currentIndex = index;
        index++;
        if (!current) return;
        setJobs((prev) =>
          prev.map((j) => (j.id === current.id ? { ...j, status: "loading" } : j)),
        );
        // rotate through uploaded images so results vary
        const img = images[currentIndex % images.length];
        const result = await runJob(current, img, unified);
        if (cancelRef.current.cancelled) return;
        setJobs((prev) => prev.map((j) => (j.id === result.id ? result : j)));
      }
    };

    const workers = Array.from(
      { length: Math.min(CONCURRENCY, initial.length) },
      () => worker(),
    );
    await Promise.all(workers);
    setRunning(false);
    if (!cancelRef.current.cancelled) {
      toast.success(`اكتمل التوليد: ${initial.length} صورة.`);
    }
  };

  const cancel = () => {
    cancelRef.current.cancelled = true;
    setRunning(false);
    toast("تم إيقاف التوليد.");
  };

  const downloadAll = async () => {
    const doneJobs = jobs.filter((j) => j.status === "done" && j.image);
    if (doneJobs.length === 0) return;
    for (let i = 0; i < doneJobs.length; i++) {
      const j = doneJobs[i];
      const name = `thumbnail-${i + 1}-${slugify(j.title) || "untitled"}.png`;
      await downloadDataUrl(j.image!, name);
      // small delay so the browser doesn't block bulk downloads
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <Toaster position="top-center" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-hero-radial" />
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-40 bg-grid" />

      <header className="container mx-auto px-4 pt-10 pb-8 text-center">
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          مدعوم بالذكاء الاصطناعي
        </div>
        <h1 className="text-balance bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-6xl">
          مولّد صور مصغرة ليوتيوب
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          ارفع صورتك، أضف قائمة عناوين (سطر لكل عنوان)، وولّد عشرات الثامنيلات
          الدرامية دفعة واحدة.
        </p>
      </header>

      <main className="container mx-auto grid gap-6 px-4 pb-20 lg:grid-cols-5">
        {/* Controls */}
        <Card className="p-6 lg:col-span-2 lg:sticky lg:top-6 lg:self-start">
          <div className="space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-sm font-semibold">
                  1. صور الأشخاص
                </Label>
                <span className="text-xs text-muted-foreground">
                  {images.length} صورة
                </span>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  onFiles(e.target.files);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              />
              <div className="grid grid-cols-3 gap-2">
                {images.map((img, i) => (
                  <div
                    key={i}
                    className="group relative aspect-video overflow-hidden rounded-md border border-border"
                  >
                    <img
                      src={img}
                      alt={`صورة ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-1 left-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="حذف"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex aspect-video items-center justify-center rounded-md border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:border-primary hover:bg-muted/60"
                >
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="h-5 w-5" />
                    <span className="text-[10px]">إضافة</span>
                  </div>
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                يمكنك رفع عدة صور — سيتم التنويع بينها تلقائيًا بين العناوين.
              </p>
            </div>

            <div>
              <Label className="mb-2 block text-sm font-semibold">
                2. اللوجوهات (اختياري)
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <LogoSlot
                  label="لوجو الشركة"
                  hint="يظهر أعلى اليمين"
                  value={companyLogo}
                  onPick={() => companyRef.current?.click()}
                  onClear={() => setCompanyLogo(null)}
                />
                <LogoSlot
                  label="لوجو الشيخ / القارئ"
                  hint="يظهر أعلى اليسار"
                  value={sheikhLogo}
                  onPick={() => sheikhRef.current?.click()}
                  onClear={() => setSheikhLogo(null)}
                />
              </div>
              <input
                ref={companyRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  onLogo(e.target.files?.[0], setCompanyLogo);
                  if (companyRef.current) companyRef.current.value = "";
                }}
              />
              <input
                ref={sheikhRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  onLogo(e.target.files?.[0], setSheikhLogo);
                  if (sheikhRef.current) sheikhRef.current.value = "";
                }}
              />
            </div>

            <div>
              <Label htmlFor="sheikhName" className="mb-2 block text-sm font-semibold">
                اسم الشيخ / القارئ (اختياري)
              </Label>
              <Input
                id="sheikhName"
                dir="rtl"
                placeholder="مثال: الشيخ محمد صديق المنشاوي"
                value={sheikhName}
                onChange={(e) => setSheikhName(e.target.value)}
                className="text-right"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                هيتكتب كتسمية صغيرة أنيقة تحت لوجو الشيخ في كل الصور.
              </p>
            </div>





            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label htmlFor="titles" className="text-sm font-semibold">
                  3. العناوين (سطر لكل عنوان)
                </Label>
                <span className="text-xs text-muted-foreground">
                  {titles.length} عنوان
                </span>
              </div>
              <Textarea
                id="titles"
                dir="rtl"
                placeholder={"مثال:\nقصة لا تصدق من التاريخ\nسر خطير كشفه العالم\nحدث غيّر مجرى الأحداث"}
                value={titlesText}
                onChange={(e) => setTitlesText(e.target.value)}
                rows={8}
                className="resize-y text-right text-base leading-loose"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                يمكنك إضافة حتى 50 عنوانًا أو أكثر — سيتم توليد صورة لكل عنوان.
              </p>
            </div>

            <div>
              <Label className="mb-2 block text-sm font-semibold">
                4. اختر الستايل
              </Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/20 p-3">
              <div className="flex-1">
                <Label htmlFor="unify" className="text-sm font-semibold">
                  توحيد الديزاين لكل الصور
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  لما تفعّلها، كل الثامنيلات هتاخد نفس الألوان ونفس تركيب التصميم — مناسبة لهوية موحّدة للقناة. لو مطفّية، كل صورة بتتصمم بشكل مختلف.
                </p>
              </div>
              <Switch
                id="unify"
                checked={unifyDesign}
                onCheckedChange={setUnifyDesign}
              />
            </div>


            {running ? (
              <Button
                onClick={cancel}
                variant="destructive"
                size="lg"
                className="w-full"
              >
                <XCircle className="h-5 w-5" />
                إيقاف
              </Button>
            ) : (
              <Button
                onClick={generate}
                variant="hero"
                size="lg"
                className="w-full"
              >
                <Sparkles className="h-5 w-5" />
                إنشاء {titles.length || ""} ثامنيل
              </Button>
            )}
          </div>
        </Card>

        {/* Results */}
        <div className="space-y-4 lg:col-span-3">
          {total > 0 && (
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="text-sm">
                <span className="font-semibold">
                  {doneCount} / {total}
                </span>{" "}
                <span className="text-muted-foreground">مكتمل</span>
                {errorCount > 0 && (
                  <span className="mr-2 text-destructive">
                    · {errorCount} فشل
                  </span>
                )}
              </div>
              <Button
                onClick={downloadAll}
                variant="hero"
                size="sm"
                disabled={doneCount === 0}
              >
                <DownloadCloud className="h-4 w-4" />
                تحميل الكل ({doneCount})
              </Button>
            </Card>
          )}

          {total === 0 ? (
            <Card className="flex min-h-[400px] flex-col items-center justify-center gap-3 p-10 text-center text-muted-foreground">
              <div className="rounded-full bg-muted p-4">
                <ImageIcon className="h-10 w-10" />
              </div>
              <p className="text-lg font-semibold text-foreground">
                معاينة الثامنيلات
              </p>
              <p className="max-w-sm text-sm">
                ارفع صورة، أضف العناوين، ثم اضغط «إنشاء الثامنيلات» لعرض النتائج
                هنا.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {jobs.map((j) => (
                <Card key={j.id} className="overflow-hidden p-0">
                  <div className="relative flex aspect-video items-center justify-center bg-muted/30">
                    {j.status === "done" && j.image ? (
                      <img
                        src={j.image}
                        alt={j.title}
                        className="h-full w-full object-cover"
                      />
                    ) : j.status === "loading" ? (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-xs">جاري التوليد...</span>
                      </div>
                    ) : j.status === "error" ? (
                      <div className="flex flex-col items-center gap-1 p-3 text-center text-destructive">
                        <XCircle className="h-6 w-6" />
                        <span className="text-xs">{j.error}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        في الانتظار
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 p-3">
                    <p className="line-clamp-2 flex-1 text-right text-sm font-medium">
                      {j.title}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={j.status !== "done"}
                      onClick={() =>
                        j.image &&
                        downloadDataUrl(
                          j.image,
                          `thumbnail-${slugify(j.title) || "untitled"}.png`,
                        )
                      }
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        صُنع بحب — مدعوم بالذكاء الاصطناعي
      </footer>
    </div>
  );
}

function LogoSlot({
  label,
  hint,
  value,
  onPick,
  onClear,
}: {
  label: string;
  hint: string;
  value: string | null;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium">{label}</span>
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="text-muted-foreground hover:text-destructive"
            aria-label="حذف"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onPick}
        className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:border-primary hover:bg-muted/60"
      >
        {value ? (
          <img src={value} alt={label} className="h-full w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Upload className="h-4 w-4" />
            <span className="text-[10px]">رفع</span>
          </div>
        )}
      </button>
      <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}

