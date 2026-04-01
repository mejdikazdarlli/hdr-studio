import { useState } from "react";

interface Props {
  src: string;
  alt?: string;
  className?: string;
}

export default function NgrokImage({ src, alt, className }: Props) {
  const [loaded, setLoaded] = useState(false);

  return (
    <img
      src={src}
      alt={alt}
      onLoad={() => setLoaded(true)}
      className={`
        transition-all duration-500
        ${!loaded ? "blur-md opacity-0" : "blur-0 opacity-100"}
        ${className || ""}
      `}
    />
  );
}