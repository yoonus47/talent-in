import Image from "next/image";
import { cn, initials, neonAvatarColor } from "@/lib/utils";

export function Avatar({
  name,
  src,
  size = 40,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className={cn("rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={cn("flex items-center justify-center rounded-full font-semibold", className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        backgroundColor: neonAvatarColor(name),
        color: "#0a0a0a",
      }}
      aria-label={name}
    >
      {initials(name) || "?"}
    </div>
  );
}
