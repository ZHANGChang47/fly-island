import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { decodeBase64 } from "../preview.ts";
import "./MarkdownRenderer.css";

interface Props {
  data: string;
}

export function MarkdownRenderer({ data }: Props) {
  const [html, setHtml] = useState("");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { marked } = await import("marked");
        const text = new TextDecoder().decode(decodeBase64(data));
        const parsed = await marked.parse(text);
        if (!cancelled) setHtml(DOMPurify.sanitize(parsed));
      } catch {
        if (!cancelled) setHtml("");
      }
    })();
    return () => { cancelled = true; };
  }, [data]);
  return <article className="markdown-renderer" dangerouslySetInnerHTML={{ __html: html }} />;
}
