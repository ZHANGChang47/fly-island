import { useEffect, useRef, useState } from "react";
import { decodeBase64 } from "../preview.ts";
import "./WordRenderer.css";

interface Props {
  data: string;
}

export function WordRenderer({ data }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;
    void (async () => {
      try {
        const { renderAsync } = await import("docx-preview");
        const bytes = decodeBase64(data);
        if (cancelled) return;
        await renderAsync(new Blob([bytes]), host, undefined, {
          className: "word-renderer__document",
          inWrapper: false,
          ignoreWidth: true,
          ignoreHeight: true,
          breakPages: true,
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [data]);

  return (
    <div className="word-renderer">
      {failed && <p className="word-renderer__status">DOCX</p>}
      <div ref={hostRef} className="word-renderer__host" />
    </div>
  );
}
