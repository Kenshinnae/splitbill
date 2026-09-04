export function LoadingScreen({
  message = "Loading…",
  hint,
}: {
  message?: string;
  /** Shown under the spinner (e.g. in-app browser / tunnel guidance). */
  hint?: string;
}) {
  return (
    <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-3 px-4">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-emerald-600/30 border-t-emerald-600"
        aria-hidden
      />
      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        {message}
      </p>
      {hint ? (
        <p className="max-w-sm text-center text-xs leading-relaxed text-zinc-400 dark:text-zinc-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
