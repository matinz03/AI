"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Card as CardType } from "@/lib/board";

export function Card({ card, onOpen }: { card: CardType; onOpen: (card: CardType) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  return (
    <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition: transition || "transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)" }} className={`group rounded-xl border border-slate-200 border-l-[3px] border-l-[#ecad0a] bg-white p-3 shadow-sm transition-[box-shadow,opacity] hover:shadow-md ${isDragging ? "opacity-25" : ""}`}>
      <div className="flex gap-2">
        <button aria-label={`Drag ${card.title}`} className="mt-0.5 cursor-grab touch-none rounded text-[#ecad0a] hover:text-[#d39300] focus:outline-none focus:ring-2 focus:ring-[#209dd7] active:cursor-grabbing" {...attributes} {...listeners}>
          <GripVertical className="size-4" />
        </button>
        <button onClick={() => onOpen(card)} className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#209dd7] focus-visible:ring-offset-2">
          <h3 className="text-sm font-semibold leading-5 text-[#032147]">{card.title}</h3>
          {card.details && <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#888888]">{card.details}</p>}
        </button>
      </div>
    </article>
  );
}
