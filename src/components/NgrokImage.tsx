import { useEffect, useState } from "react";

interface Props {
  src: string;
  alt?: string;
  className?: string;
}

export default function NgrokImage({ src, alt, className }: Props) {
  const [safeSrc, setSafeSrc] = useState<string>("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const res = await fetch(src, {
          headers: { "ngrok-skip-browser-warning": "true" }
        });

        const blob = await res.blob();

        if (!active) return;

        const url = URL.createObjectURL(blob);
        setSafeSrc(url);
      } catch (e) {
        console.error("Preview load failed:", e);
      }
    };

    load();

    return () => {
      active = false;
      if (safeSrc.startsWith("blob:")) URL.revokeObjectURL(safeSrc);
    };
  }, [src]);

  if (!safeSrc) return null;

  return <img src={safeSrc} alt={alt} className={className} />;
}