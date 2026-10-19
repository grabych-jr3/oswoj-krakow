import { cn } from "@/lib/utils";

/**
 * Brand mark: a map pin whose head is a chat bubble (assistant + map),
 * on the Kraków-red rounded square used in the design.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-7 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect width="32" height="32" rx="9" fill="oklch(0.53 0.21 27)" />
      {/* pin: rounded bubble with a tail pointing down */}
      <path
        d="M16 6.5c-4.7 0-8.5 3.5-8.5 7.9 0 3.6 2.5 6.6 6 7.6L16 25.5l2.5-3.5c3.5-1 6-4 6-7.6 0-4.4-3.8-7.9-8.5-7.9Z"
        fill="#fff"
      />
      {/* ring = "you are here" / location, same motif as the design placeholder */}
      <circle cx="16" cy="14.4" r="3.2" fill="none" stroke="oklch(0.53 0.21 27)" strokeWidth="2.4" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-base font-bold tracking-[-0.02em] text-foreground">Oswój Kraków</span>
    </span>
  );
}
