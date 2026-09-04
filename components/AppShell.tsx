import Link from "next/link";

export function AppShell({
  title,
  children,
  action,
  showHomeLink = true,
}: {
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  showHomeLink?: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col px-4 pb-28 pt-4 sm:px-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {showHomeLink ? (
            <Link
              href="/dashboard"
              className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400"
            >
              SplitBill
            </Link>
          ) : (
            <span className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              SplitBill
            </span>
          )}
          {title ? (
            <h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {title}
            </h1>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
