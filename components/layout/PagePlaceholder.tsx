import type { ComponentType, ReactNode } from "react";

type IconCmp = ComponentType<{ size?: number | string; className?: string }>;

/**
 * A shared, on-token shell for a product surface whose feature logic lands in a
 * later task. Renders a titled header + description in the centered thread
 * column; feature UI slots into `children`.
 */
export function PagePlaceholder({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon?: IconCmp;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-thread flex-col px-4 py-10">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-muted text-fg-secondary">
            <Icon size={20} />
          </span>
        )}
        <h2 className="text-2xl font-semibold text-fg">{title}</h2>
      </div>
      <p className="mt-2 text-sm text-fg-secondary">{description}</p>
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}
