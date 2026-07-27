import { LegacyEnhancements } from "./LegacyEnhancements";

export type LegacySource = {
  source: string;
  styles: string;
  body: string;
  scripts: string[];
};

type Replacement = readonly [from: string, to: string];

export function applyReplacements(body: string, replacements: readonly Replacement[]) {
  return replacements.reduce((html, [from, to]) => html.replaceAll(from, to), body);
}

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function LegacyDocument({
  document,
  pageKey,
  body = document.body,
}: {
  document: LegacySource;
  pageKey: string;
  body?: string;
}) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: document.styles }} />
      <div
        className={`legacy-page legacy-page--${pageKey}`}
        data-original={document.source}
        dangerouslySetInnerHTML={{ __html: body }}
      />
      <LegacyEnhancements pageKey={pageKey} />
    </>
  );
}
