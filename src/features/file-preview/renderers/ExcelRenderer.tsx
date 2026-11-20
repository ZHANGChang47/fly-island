import { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { decodeBase64 } from "../preview.ts";
import "./ExcelRenderer.css";

interface Props {
  data: string;
  isCsv: boolean;
}

export function ExcelRenderer({ data, isCsv }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    void (async () => {
      try {
        const XLSX = await import("xlsx");
        const bytes = decodeBase64(data);
        if (cancelled) return;
        const workbook = isCsv
          ? XLSX.read(new TextDecoder().decode(bytes), { type: "string" })
          : XLSX.read(bytes, { type: "array" });
        host.replaceChildren();
        for (const name of workbook.SheetNames) {
          const section = document.createElement("section");
          section.className = "excel-renderer__sheet";
          const title = document.createElement("h3");
          title.textContent = name;
          const table = document.createElement("div");
          table.innerHTML = DOMPurify.sanitize(
            XLSX.utils.sheet_to_html(workbook.Sheets[name], { editable: false }),
          );
          section.append(title, table);
          host.append(section);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [data, isCsv]);

  return (
    <div className="excel-renderer">
      {failed && <p className="excel-renderer__status">XLSX</p>}
      <div ref={hostRef} />
    </div>
  );
}
