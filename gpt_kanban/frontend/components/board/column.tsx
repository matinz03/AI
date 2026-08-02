"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Check, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/board/card";
import { Button } from "@/components/ui/button";
import type { Card as CardType, Column as ColumnType } from "@/lib/board";

export function Column({ column, onRename, onAdd, onOpenCard }: { column: ColumnType; onRename: (id: string, title: string) => void; onAdd: (id: string) => void; onOpenCard: (card: CardType) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(column.title);

  const save = () => {
    const nextTitle = title.trim();
    if (nextTitle) onRename(column.id, nextTitle);
    else setTitle(column.title);
    setEditing(false);
  };

  return (
    <section ref={setNodeRef} role="region" className="flex w-[288px] shrink-0 flex-col rounded-2xl bg-[#eaf0f6] p-3" aria-label={`${column.title} column`}>
      <div className="mb-3 flex min-h-9 items-center gap-2 px-1">
        {editing ? (
          <><input aria-label="Column title" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") save(); if (event.key === "Escape") { setTitle(column.title); setEditing(false); } }} onBlur={save} className="min-w-0 flex-1 rounded-md border border-[#209dd7] bg-white px-2 py-1 text-sm font-bold text-[#032147] outline-none ring-2 ring-[#209dd7]/20" /><button aria-label="Save column title" onMouseDown={(event) => event.preventDefault()} onClick={save} className="text-[#209dd7]"><Check className="size-4" /></button></>
        ) : (
          <><h2 className="min-w-0 flex-1 truncate text-sm font-bold tracking-wide text-[#032147]">{column.title}</h2><button aria-label={`Rename ${column.title}`} onClick={() => setEditing(true)} className="rounded p-1 text-[#888888] hover:bg-white hover:text-[#209dd7] focus:outline-none focus:ring-2 focus:ring-[#209dd7]"><Pencil className="size-3.5" /></button></>
        )}
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-[#888888]">{column.cards.length}</span>
      </div>
      <div className={`min-h-28 space-y-2 rounded-xl transition-colors ${isOver ? "bg-[#209dd7]/10" : ""}`}>
        <SortableContext items={column.cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
          {column.cards.map((card) => <Card key={card.id} card={card} onOpen={onOpenCard} />)}
        </SortableContext>
        {!column.cards.length && <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-slate-300 px-5 text-center text-xs leading-5 text-[#888888]">Drop a card here or add a new one.</div>}
      </div>
      <Button variant="ghost" onClick={() => onAdd(column.id)} className="mt-3 w-full justify-start gap-2 text-[#753991] hover:bg-white hover:text-[#753991]"><Plus className="size-4" /> Add card</Button>
    </section>
  );
}
