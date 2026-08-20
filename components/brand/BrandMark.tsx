import Image from "next/image"

import { cn } from "@/lib/utils"

/**
 * Official Ginny House icon (house outline + crossed ribbon). This login
 * page's background is always the navy `bg-primary` regardless of light/dark
 * mode, so the mark is always the white cutout — no theme-aware switching
 * needed here (unlike the reference app, which also uses this mark on
 * light-mode surfaces elsewhere and needs `variant="auto"` for that).
 */
export default function BrandMark({
  className,
  priority = false,
}: {
  className?: string
  /** Only the one instance that's actually above-the-fold LCP-critical should set this. */
  priority?: boolean
}) {
  return (
    <span className={cn("relative inline-block", className)}>
      <Image
        src="/brand/icon-white.png"
        alt=""
        fill
        sizes="128px"
        className="object-contain"
        priority={priority}
      />
    </span>
  )
}
