import { createClient } from "../lib/supabase/server";

export const DEFAULT_SETTINGS = {
  hero_eyebrow: "Coaching ontológico para mujeres",
  hero_title: "Salí a comerte el mundo",
  hero_subtitle:
    "No sos lo que te pasó. Sos lo que vas a hacer con todo eso. Te acompaño a dejar de postergarte y volver a elegirte.",
  story_title: "Toqué fondo y elegí levantarme.",
  story_body:
    "Hubo una etapa en la que me sentí perdida, apagada, sin saber para dónde ir. Desde ese lugar tomé la decisión más difícil: dejar de esperar que alguien me rescatara y empezar a moverme yo. Hoy acompaño a otras mujeres a hacer exactamente eso.",
  membership_title: "Bienvenidas a bordo",
  membership_body:
    "Un espacio mensual para sentirte más segura, confiar en tus decisiones y aprender a elegirte sin dar explicaciones.",
  membership_price_regular: "$70.000",
  membership_price_sale: "$51.999",
  membership_purchase_url: "",
  current_theme: "Reconstruir mi valor",
  current_theme_description:
    "Un mes para reconocer lo que valés y sostenerlo, aunque nadie te lo confirme.",
  next_session_label: "Sábado · 19:00 h",
  next_session_url: "",
  whatsapp_url: "https://wa.me/5492964406552",
  instagram_url: "https://instagram.com/maricelconse",
} as const;

export type SettingKey = keyof typeof DEFAULT_SETTINGS;
export type SiteSettings = Record<SettingKey, string>;

export type EbookRecord = {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  regularPrice: string;
  salePrice: string;
  purchaseUrl: string;
  coverImage: string;
  sortOrder: number;
  isPublished: boolean;
};

export type ResourceRecord = {
  id: number;
  kind: "class" | "activity" | "audio" | "guide" | "resource";
  monthLabel: string;
  title: string;
  description: string;
  url: string;
  sortOrder: number;
  isPublished: boolean;
};

export type ContentBundle = {
  settings: SiteSettings;
  ebooks: EbookRecord[];
  resources: ResourceRecord[];
};

const DEFAULT_EBOOKS: Omit<EbookRecord, "id">[] = [
  {
    slug: "equipaje-liviano",
    title: "Equipaje liviano",
    subtitle: "Soltar lo que pesa para volver a vos.",
    description:
      "Para reconocer qué estás cargando, qué no te toca y cómo empezar a soltarlo sin culpa.",
    regularPrice: "$24.999",
    salePrice: "$15.999",
    purchaseUrl: "",
    coverImage: "/images/ebook-equipaje-liviano.jpg",
    sortOrder: 1,
    isPublished: true,
  },
  {
    slug: "el-destino-sos-vos",
    title: "El destino sos vos",
    subtitle: "Encontrar tu rumbo cuando perdiste el norte.",
    description:
      "Cinco pasos para dejar de seguir el mapa de otros, escuchar tu brújula y dar un paso propio.",
    regularPrice: "$24.999",
    salePrice: "$15.999",
    purchaseUrl: "",
    coverImage: "/images/ebook-el-destino-sos-vos.jpg",
    sortOrder: 2,
    isPublished: true,
  },
  {
    slug: "sin-turbulencias",
    title: "Sin turbulencias",
    subtitle: "Calma para habitarte sin pelearla.",
    description:
      "Herramientas simples para atravesar la ansiedad, volver al presente y tratarte con más calma.",
    regularPrice: "$24.999",
    salePrice: "$15.999",
    purchaseUrl: "",
    coverImage: "/images/ebook-sin-turbulencias.jpg",
    sortOrder: 3,
    isPublished: true,
  },
  {
    slug: "el-cielo-no-es-el-limite",
    title: "El cielo no es el límite",
    subtitle: "Animarte a soñar sin ponerte techo.",
    description:
      "Para revisar ese techo invisible y bajar tu sueño grande a un primer paso concreto, con fecha.",
    regularPrice: "$24.999",
    salePrice: "$15.999",
    purchaseUrl: "",
    coverImage: "/images/ebook-el-cielo-no-es-el-limite.jpg",
    sortOrder: 4,
    isPublished: true,
  },
];

const DEFAULT_RESOURCES: Omit<ResourceRecord, "id">[] = [
  {
    kind: "guide",
    monthLabel: "Primeros pasos",
    title: "Guía de viaje: cómo funciona este espacio",
    description: "Un recorrido rápido para encontrar cada recurso sin perderte.",
    url: "/guia-de-viaje",
    sortOrder: 1,
    isPublished: true,
  },
];

function fallbackBundle(): ContentBundle {
  return {
    settings: { ...DEFAULT_SETTINGS },
    ebooks: DEFAULT_EBOOKS.map((ebook, index) => ({ ...ebook, id: index + 1 })),
    resources: DEFAULT_RESOURCES.map((resource, index) => ({ ...resource, id: index + 1 })),
  };
}

export async function getContentBundle(): Promise<ContentBundle> {
  try {
    const supabase = await createClient();
    const [settingsResult, ebooksResult, resourcesResult] = await Promise.all([
      supabase.from("site_settings").select("key, value"),
      supabase.from("ebooks").select("*").order("sort_order").order("id"),
      supabase.from("member_resources").select("*").order("sort_order").order("id"),
    ]);

    const queryError = settingsResult.error || ebooksResult.error || resourcesResult.error;
    if (queryError) throw queryError;

    const settings = { ...DEFAULT_SETTINGS } as SiteSettings;
    for (const row of settingsResult.data || []) {
      if (row.key in settings) settings[row.key as SettingKey] = String(row.value ?? "");
    }

    return {
      settings,
      ebooks: (ebooksResult.data || []).map(mapEbookRow),
      resources: (resourcesResult.data || []).map(mapResourceRow),
    };
  } catch {
    return fallbackBundle();
  }
}

function mapEbookRow(row: Record<string, unknown>): EbookRecord {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    title: String(row.title),
    subtitle: String(row.subtitle ?? ""),
    description: String(row.description ?? ""),
    regularPrice: String(row.regular_price ?? ""),
    salePrice: String(row.sale_price ?? ""),
    purchaseUrl: String(row.purchase_url ?? ""),
    coverImage: String(row.cover_image ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
    isPublished: Boolean(row.is_published),
  };
}

function mapResourceRow(row: Record<string, unknown>): ResourceRecord {
  return {
    id: Number(row.id),
    kind: String(row.kind) as ResourceRecord["kind"],
    monthLabel: String(row.month_label ?? ""),
    title: String(row.title),
    description: String(row.description ?? ""),
    url: String(row.url ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
    isPublished: Boolean(row.is_published),
  };
}

export async function updateSettings(values: Partial<SiteSettings>) {
  const rows = Object.entries(values)
    .filter(([key]) => key in DEFAULT_SETTINGS)
    .map(([key, value]) => ({ key, value: String(value ?? "").trim() }));
  if (!rows.length) return;

  const supabase = await createClient();
  const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });
  if (error) throw error;
}

export async function upsertEbook(input: Partial<EbookRecord>) {
  const supabase = await createClient();
  const row = {
    slug: slugify(input.slug || input.title || "ebook"),
    title: String(input.title || "Nuevo ebook").trim(),
    subtitle: String(input.subtitle || "").trim(),
    description: String(input.description || "").trim(),
    regular_price: String(input.regularPrice || "").trim(),
    sale_price: String(input.salePrice || "").trim(),
    purchase_url: safeUrl(input.purchaseUrl),
    cover_image: safeAssetPath(input.coverImage),
    sort_order: Number(input.sortOrder || 0),
    is_published: Boolean(input.isPublished),
  };
  const { error } = await supabase.from("ebooks").upsert(row, { onConflict: "slug" });
  if (error) throw error;
}

export async function upsertResource(input: Partial<ResourceRecord>) {
  const supabase = await createClient();
  const kind = ["class", "activity", "audio", "guide", "resource"].includes(String(input.kind))
    ? String(input.kind)
    : "resource";
  const row = {
    kind,
    month_label: String(input.monthLabel || "").trim(),
    title: String(input.title || "Nuevo recurso").trim(),
    description: String(input.description || "").trim(),
    url: safeUrl(input.url),
    sort_order: Number(input.sortOrder || 0),
    is_published: Boolean(input.isPublished),
  };

  const query = input.id && Number(input.id) > 0
    ? supabase.from("member_resources").update(row).eq("id", Number(input.id))
    : supabase.from("member_resources").insert(row);
  const { error } = await query;
  if (error) throw error;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "ebook";
}

function safeUrl(value: unknown) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function safeAssetPath(value: unknown) {
  const path = String(value || "").trim();
  if (path.startsWith("/images/")) return path;
  return safeUrl(path);
}
