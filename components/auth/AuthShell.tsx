import type { ReactNode } from "react";

/** Centered auth card: "E" monogram + heading + subtitle + slot. Tokens only. */
export function AuthShell({
  title, subtitle, children, footer,
}: {
  title: string; subtitle?: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="grid h-11 w-11 place-items-center rounded-[10px] bg-primary text-lg font-semibold text-fg-inverted">
            E
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-fg">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-fg-secondary">{subtitle}</p> : null}
          </div>
        </div>
        {children}
        {footer ? <div className="mt-6 text-center text-sm text-fg-secondary">{footer}</div> : null}
      </div>
    </div>
  );
}

/** "or" hairline divider, shared by the login/signup pages. */
export function OrDivider() {
  return (
    <div className="my-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-line" />
      <span className="text-xs text-fg-muted">or</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
