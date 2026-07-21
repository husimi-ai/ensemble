"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";

const MODELS = [
  { id: "auto", name: "Ensemble Auto", desc: "Picks the best model for each task" },
  { id: "fast", name: "Ensemble Fast", desc: "Great for everyday tasks" },
  { id: "pro", name: "Ensemble Pro", desc: "Advanced reasoning and analysis" },
];

export function ModelSwitcher() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("auto");

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-lg font-semibold text-fg hover:bg-hover"
      >
        Ensemble
        <ChevronDown size={18} className="text-fg-secondary" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="pop-in absolute left-0 top-full z-50 mt-1 w-[340px] rounded-2xl border border-line-light bg-elevated p-1.5 shadow-pop">
            {MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSelected(m.id);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-hover"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-fg">{m.name}</div>
                  <div className="text-xs text-fg-muted">{m.desc}</div>
                </div>
                {selected === m.id && <Check size={18} className="mt-0.5 shrink-0 text-fg" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
