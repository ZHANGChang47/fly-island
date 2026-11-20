import { useEffect, useMemo } from "react";
import { decodeBase64, objectUrl } from "../preview.ts";

interface Props {
  data: string;
  mime: string;
  name: string;
}

export function ImageRenderer({ data, mime, name }: Props) {
  const url = useMemo(() => objectUrl(decodeBase64(data), mime), [data, mime]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img className="image-renderer" src={url} alt={name} />;
}
