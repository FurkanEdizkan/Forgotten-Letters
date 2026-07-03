export function Divider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-border" />
      <span className="font-mono text-[0.625rem] uppercase tracking-wider text-faint">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
