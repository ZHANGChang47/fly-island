import { useEffect, useRef, useState } from "react";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { decodeBase64 } from "../preview.ts";
import "./PdfRenderer.css";

interface Props {
  data: string;
}

export function PdfRenderer({ data }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    const tasks: Array<{ cancel: () => void }> = [];
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren();
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const bytes = decodeBase64(data);
        const pdfDocument = await pdfjs.getDocument({ data: bytes }).promise;
        if (cancelled) return;
        for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
          const page = await pdfDocument.getPage(pageNumber);
          if (cancelled) return;
          const viewport = page.getViewport({ scale: 1.35 });
          const canvas = document.createElement("canvas") as HTMLCanvasElement;
          canvas.className = "pdf-renderer__page";
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          host.append(canvas);
          const context = canvas.getContext("2d");
          if (!context) continue;
          const task = page.render({ canvas, canvasContext: context, viewport });
          tasks.push(task);
          await task.promise;
        }
        if (!cancelled) setState("ready");
      } catch {
        if (!cancelled) setState("failed");
      }
    })();
    return () => {
      cancelled = true;
      for (const task of tasks) task.cancel();
    };
  }, [data]);

  return (
    <div className="pdf-renderer">
      {state === "loading" && <p className="pdf-renderer__status">…</p>}
      {state === "failed" && <p className="pdf-renderer__status">PDF</p>}
      <div ref={hostRef} className="pdf-renderer__pages" />
    </div>
  );
}
