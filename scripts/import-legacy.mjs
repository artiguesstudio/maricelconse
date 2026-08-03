import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const root = process.cwd();
const sourceDir = join(root, "work", "legacy-html");
const outputDir = join(root, "app", "legacy", "generated");
const assetDir = join(root, "public", "legacy-assets");

if (!existsSync(sourceDir)) {
  throw new Error(`No se encontraron los HTML originales en ${sourceDir}`);
}

const sourceFiles = readdirSync(sourceDir).filter((name) => name.toLowerCase().endsWith(".html"));
const find = (test) => {
  const name = sourceFiles.find(test);
  if (!name) throw new Error("Falta uno de los HTML originales requeridos");
  return name;
};

const pages = {
  home: find((name) => name.startsWith("1__")),
  membership: find((name) => name.startsWith("2__")),
  member: find((name) => name.startsWith("3__")),
  travelGuide: find((name) => name.startsWith("4__")),
  ebooks: find((name) => name === "WEB_PARA_EBOOKS.html"),
  sessions: find((name) => name === "HTML_SESIONES_FINAL.html"),
  miniGuide: find((name) => name === "MINI-GUIA_GRATUITA.html"),
};

mkdirSync(outputDir, { recursive: true });
rmSync(assetDir, { recursive: true, force: true });
mkdirSync(assetDir, { recursive: true });

const mimeExtensions = {
  gif: "gif",
  jpeg: "jpg",
  jpg: "jpg",
  png: "png",
  "svg+xml": "svg",
  webp: "webp",
};

function extractAssets(document) {
  return document.replace(/data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,([A-Za-z0-9+/=]+)/gi, (_, mime, encoded) => {
    const bytes = Buffer.from(encoded, "base64");
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    const extension = mimeExtensions[mime.toLowerCase()] || "bin";
    const filename = `${hash}.${extension}`;
    const target = join(assetDir, filename);
    if (!existsSync(target)) writeFileSync(target, bytes);
    return `/legacy-assets/${filename}`;
  });
}

function rewriteInternalLinks(body) {
  const replacements = [
    ["index.html", "/"],
    ["mini-guia.html", "/mini-guia"],
    ["membresia.html", "/membresia"],
    ["area-socias.html", "/mi-espacio"],
    ["archivos/instructivo.pdf", "/guia-de-viaje"],
    [
      "https://wa.me/5492964406552?text=Hola%20Maricel%2C%20quiero%20info%20de%20las%20sesiones%20online",
      "/sesiones",
    ],
    [
      "https://wa.me/5492964406552?text=Hola%20Maricel%2C%20quiero%20info%20de%20los%20ebooks",
      "/ebooks",
    ],
  ];

  let next = body;
  for (const [from, to] of replacements) next = next.replaceAll(from, to);
  return next.replace(/href="(\/(?:mini-guia|membresia|mi-espacio|guia-de-viaje|sesiones|ebooks)?)"\s+target="_blank"\s+rel="noopener"/g, 'href="$1"');
}

function replaceBundledFonts(styles) {
  return styles
    .replaceAll("'Archivo'", "var(--font-archivo)")
    .replaceAll("'Fraunces'", "var(--font-display)")
    .replaceAll("'Mulish'", "var(--font-sans)")
    .replaceAll("'Jost'", "var(--font-jost)")
    .replaceAll("'Montserrat'", "var(--font-montserrat)")
    .replaceAll("'Caveat'", "var(--font-caveat)");
}

function applyProjectAdjustments(key, body) {
  if (key !== "member") return body;

  return body
    .split("\n")
    .filter((line) => !line.includes("<b>Guía de bienvenida</b>"))
    .join("\n");
}

for (const [key, filename] of Object.entries(pages)) {
  const raw = extractAssets(readFileSync(join(sourceDir, filename), "utf8"));
  const styleMatch = raw.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!styleMatch || !bodyMatch) throw new Error(`No se pudo interpretar ${filename}`);

  const scripts = [...bodyMatch[1].matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1].trim());
  const body = applyProjectAdjustments(
    key,
    rewriteInternalLinks(bodyMatch[1].replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").trim()),
  );
  const output = {
    source: basename(filename),
    styles: `${replaceBundledFonts(styleMatch[1].trim())}${key === "miniGuide" ? "\n@media(max-width:480px){.cover{margin-left:-18px;margin-right:-18px;padding-inline:18px}}" : ""}`,
    body,
    scripts,
  };
  writeFileSync(join(outputDir, `${key}.json`), `${JSON.stringify(output, null, 2)}\n`, "utf8");
}

console.log(`Importadas ${Object.keys(pages).length} páginas y ${readdirSync(assetDir).length} recursos originales.`);
