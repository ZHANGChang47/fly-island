import type { PreviewKind } from "./api.ts";

/** Extension → renderer, kept in sync with file_preview/model.rs. */
export function kindForExtension(extension: string): PreviewKind | null {
  switch (extension.trim().replace(/^\./, "").toLowerCase()) {
    case "pdf": return "pdf";
    case "docx": return "word";
    case "xlsx": case "xlsm": case "csv": case "tsv": return "excel";
    case "pptx": return "slides";
    case "md": case "markdown": case "mdx": return "markdown";
    case "jpg": case "jpeg": case "png": case "gif": case "webp": case "bmp": return "image";
    default: return null;
  }
}

/** Decodes base64 once, at the renderer boundary. */
export function decodeBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function objectUrl(bytes: Uint8Array, mime: string): string {
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

export function mimeFor(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  const known: Record<string, string> = {
    pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg",
    png: "image/png", gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
    md: "text/markdown", markdown: "text/markdown", csv: "text/csv", tsv: "text/tsv",
  };
  return known[extension] ?? "application/octet-stream";
}
