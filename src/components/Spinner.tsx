export default function Spinner({ size = 28, label }: { size?: number; label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 text-zinc-400">
      <span
        style={{ width: size, height: size }}
        className="inline-block animate-spin rounded-full border-2 border-zinc-200 border-t-accent dark:border-zinc-700 dark:border-t-accent"
      />
      {label && <span className="text-xs">{label}</span>}
    </div>
  );
}

export const COPYRIGHT = "© 2026 FAUZANZR";
