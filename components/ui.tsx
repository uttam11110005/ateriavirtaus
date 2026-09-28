"use client";

import {
  CheckCircle,
  CircleDashed,
  Clock,
  Minus,
  PencilSimpleLine,
  Plus,
  WarningCircle,
  ArrowClockwise,
} from "@phosphor-icons/react";
import Link from "next/link";
import { forwardRef, useId } from "react";
import type { Confidence, DemandStatus } from "@/lib/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ---------------- Status ---------------- */

export const STATUS_META: Record<DemandStatus, { label: string; cls: string; Icon: typeof CheckCircle; hint: string }> = {
  confirmed: { label: "Confirmed", cls: "bg-ok-soft text-ok", Icon: CheckCircle, hint: "Confirmed before the deadline" },
  changed: { label: "Changed", cls: "bg-info-soft text-info", Icon: PencilSimpleLine, hint: "Corrected after confirmation" },
  late: { label: "Late", cls: "bg-warn-soft text-warn", Icon: Clock, hint: "Confirmed after the deadline" },
  missing: { label: "Missing", cls: "bg-bad-soft text-bad", Icon: WarningCircle, hint: "Deadline passed without confirmation" },
  draft: { label: "Draft", cls: "bg-draft-soft text-draft", Icon: CircleDashed, hint: "Not yet confirmed — deadline still open" },
};

export function StatusBadge({ status, size = "md" }: { status: DemandStatus; size?: "sm" | "md" }) {
  const m = STATUS_META[status];
  return (
    <span
      title={m.hint}
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-[13px]",
        m.cls,
      )}
    >
      <m.Icon size={size === "sm" ? 13 : 15} weight="bold" aria-hidden />
      {m.label}
    </span>
  );
}

const CONF: Record<Confidence, { label: string; cls: string; bars: number }> = {
  high: { label: "High confidence", cls: "text-ok", bars: 3 },
  medium: { label: "Medium confidence", cls: "text-warn", bars: 2 },
  low: { label: "Low confidence", cls: "text-bad", bars: 1 },
};

export function ConfidenceBadge({ level, compact }: { level: Confidence; compact?: boolean }) {
  const c = CONF[level];
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-[13px] font-medium", c.cls)}>
      <span className="flex items-end gap-[2px]" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cx("w-[3px] rounded-sm", i < c.bars ? "bg-current" : "bg-current opacity-20")}
            style={{ height: 5 + i * 3 }}
          />
        ))}
      </span>
      {compact ? c.label.split(" ")[0] : c.label}
    </span>
  );
}

/* ---------------- Buttons ---------------- */

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        "press inline-flex cursor-pointer items-center justify-center gap-2 rounded-[10px] font-medium disabled:cursor-not-allowed disabled:opacity-55",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-11 px-4 text-[15px]",
        size === "lg" && "h-13 px-5 text-base",
        variant === "primary" && "bg-accent text-white hover:bg-accent-hover",
        variant === "secondary" && "border border-line-strong bg-surface text-ink hover:border-ink-3",
        variant === "ghost" && "text-ink-2 hover:bg-sunken hover:text-ink",
        variant === "danger" && "border border-bad/30 bg-surface text-bad hover:bg-bad-soft",
        className,
      )}
      {...rest}
    >
      {loading && <ArrowClockwise size={16} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function LinkButton({
  href,
  children,
  variant = "secondary",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "press inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-3.5 text-sm font-medium",
        variant === "primary" && "bg-accent text-white hover:bg-accent-hover",
        variant === "secondary" && "border border-line-strong bg-surface text-ink hover:border-ink-3",
        variant === "ghost" && "text-ink-2 hover:bg-sunken hover:text-ink",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/* ---------------- Form fields ---------------- */

export function Field({
  label,
  help,
  error,
  children,
  htmlFor,
}: {
  label: string;
  help?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-[13px] font-medium text-bad" role="alert">
          <WarningCircle size={14} weight="bold" aria-hidden />
          {error}
        </p>
      ) : help ? (
        <p className="text-[13px] text-ink-3">{help}</p>
      ) : null}
    </div>
  );
}

export const inputCls =
  "h-11 w-full rounded-[10px] border border-line-strong bg-surface px-3 text-[15px] text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-ink-3 focus:border-accent focus:shadow-[0_0_0_3px_rgba(29,92,71,0.15)] aria-invalid:border-bad aria-invalid:shadow-[0_0_0_3px_rgba(160,43,43,0.12)]";

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 9999,
  label,
  big,
  invalid,
  step = 1,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  label: string;
  big?: boolean;
  invalid?: boolean;
  step?: number;
}) {
  const id = useId();
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div
      className={cx(
        "flex items-stretch overflow-hidden rounded-[12px] border bg-surface",
        invalid ? "border-bad" : "border-line-strong",
        big ? "h-14" : "h-11",
      )}
    >
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        className="press flex w-12 shrink-0 cursor-pointer items-center justify-center text-ink-2 hover:bg-sunken disabled:opacity-35 sm:w-14"
      >
        <Minus size={18} weight="bold" />
      </button>
      <input
        id={id}
        aria-label={label}
        aria-invalid={invalid || undefined}
        inputMode="numeric"
        type="number"
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => {
          const n = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(Math.max(0, n));
        }}
        onFocus={(e) => e.target.select()}
        className={cx(
          "num w-full min-w-0 border-x border-line bg-transparent text-center text-ink outline-none focus:bg-accent-soft/40",
          big ? "text-2xl font-semibold" : "text-lg font-medium",
        )}
      />
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        className="press flex w-12 shrink-0 cursor-pointer items-center justify-center text-ink-2 hover:bg-sunken disabled:opacity-35 sm:w-14"
      >
        <Plus size={18} weight="bold" />
      </button>
    </div>
  );
}

/* ---------------- Layout bits ---------------- */

export function PageHeader({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rise flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-[13px] font-medium text-ink-3">{eyebrow}</div>}
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.025em] text-ink md:text-[30px]">{title}</h1>
        {children && <div className="mt-1.5 max-w-[68ch] text-[15px] leading-relaxed text-ink-2">{children}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "bad" | "warn" | "info" | "ok";
  icon?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 px-5 py-4">
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-ink-3">
        {icon}
        {label}
      </div>
      <div
        className={cx(
          "num mt-1 text-[28px] font-semibold leading-none tracking-tight",
          tone === "bad" && "text-bad",
          tone === "warn" && "text-warn",
          tone === "info" && "text-info",
          tone === "ok" && "text-ok",
          !tone && "text-ink",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[13px] text-ink-3">{sub}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-start gap-3 p-6" role="alert">
      <div className="flex items-center gap-2 font-medium text-bad">
        <WarningCircle size={18} weight="bold" /> Could not load this view
      </div>
      <p className="text-sm text-ink-2">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[14px] border border-dashed border-line-strong px-6 py-10 text-center">
      <div className="font-medium text-ink">{title}</div>
      {children && <p className="max-w-[46ch] text-sm text-ink-3">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[10px] border border-line bg-sunken p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "press h-8 cursor-pointer rounded-[8px] px-3 text-[13px] font-medium",
            value === o.value ? "bg-surface text-ink shadow-[0_1px_2px_rgba(28,27,25,0.12)]" : "text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const selectCls =
  "h-10 cursor-pointer rounded-[10px] border border-line-strong bg-surface pl-3 pr-8 text-sm text-ink outline-none focus:border-accent";
