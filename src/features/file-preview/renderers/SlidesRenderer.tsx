import { useEffect, useRef, useState } from "react";
import { decodeBase64 } from "../preview.ts";
import "./SlidesRenderer.css";

interface Props {
  data: string;
}

export function SlidesRenderer({ data }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let instance: { preview: (data: ArrayBuffer) => Promise<unknown>; destroy: () => void } | null = null;
    const host = hostRef.current;
    if (!host) return;
    void (async () => {
      try {
        const { init } = await import("pptx-preview");
        const bytes = decodeBase64(data);
        if (cancelled) return;
        host.replaceChildren();
        const previewer = init(host, { width: 960, height: 540, mode: "list" });
        instance = previewer;
        await previewer.preview(bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, [data]);

  return (
    <div className="slides-renderer">
      {failed && <p className="slides-renderer__status">PPTX</p>}
      <div ref={hostRef} className="slides-renderer__host" />
    </div>
  );
}
