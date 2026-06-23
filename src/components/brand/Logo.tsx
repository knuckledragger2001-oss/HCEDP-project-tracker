import type { CSSProperties } from "react";

// Official HCEDP brand assets (single-color), stored in public/brand/.
//   logo-mark.png — the blue medallion mark
//   wordmark.png  — the green "HAYS CALDWELL / Economic Development Partnership"
// Plain <img> is intentional (simple static assets, no next/image config needed).

export function LogoMark({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/logo-mark.png" alt="" className={className} style={style} />
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/wordmark.png"
      alt="Hays Caldwell Economic Development Partnership"
      className={className}
    />
  );
}

// Full brand lockup: mark + wordmark. The wordmark hides on very narrow screens.
export function BrandLockup() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className="h-9 w-9 shrink-0" />
      <Wordmark className="hidden h-7 w-auto sm:block" />
    </span>
  );
}
