"use client";

import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCorners, pointerWithin, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CircleDot, LayoutDashboard, Plus, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { Column } from "@/components/board/column";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { initialColumns, moveCard, type Card, type Column as ColumnType } from "@/lib/board";

export function Board() {
  const [columns, setColumns] = useState<ColumnType[]>(initialColumns);
  const [addColumnId, setAddColumnId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const openAdd = (columnId: string) => { setAddColumnId(columnId); setTitle(""); setDetails(""); setError(""); };
  const closeAdd = () => setAddColumnId(null);
  const renameColumn = (id: string, nextTitle: string) => setColumns((current) => current.map((column) => column.id === id ? { ...column, title: nextTitle } : column));
  const deleteCard = (id: string) => { setColumns((current) => current.map((column) => ({ ...column, cards: column.cards.filter((card) => card.id !== id) }))); setSelectedCard(null); };
  const createCard = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) { setError("Give this card a title to continue."); return; }
    const card = { id: `card-${Date.now()}`, title: title.trim(), details: details.trim() };
    setColumns((current) => current.map((column) => column.id === addColumnId ? { ...column, cards: [...column.cards, card] } : column));
    closeAdd();
  };
  const findCard = (id: string) => columns.flatMap((column) => column.cards).find((card) => card.id === id) ?? null;
  const collisionDetection = (args: Parameters<typeof pointerWithin>[0]) => {
    const pointerCollisions = pointerWithin(args);
    return pointerCollisions.length ? pointerCollisions : closestCorners(args);
  };
  const moveAcrossColumns = (activeId: string, overId: string) => {
    setColumns((current) => {
      const activeColumnIndex = current.findIndex((column) => column.cards.some((card) => card.id === activeId));
      const overColumnIndex = current.findIndex((column) => column.id === overId || column.cards.some((card) => card.id === overId));
      if (activeColumnIndex < 0 || overColumnIndex < 0 || activeColumnIndex === overColumnIndex) return current;
      return moveCard(current, activeId, overId);
    });
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#fffaf0]">
      <header className="border-b border-t-4 border-slate-200 border-t-[#ecad0a] bg-white">
        <div className="mx-auto flex h-[76px] min-w-[1024px] max-w-[1800px] items-center justify-between px-10">
          <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[#032147] text-[#ecad0a]"><LayoutDashboard className="size-5" /></div><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#209dd7]">Product workspace</p><h1 className="text-xl font-bold text-[#032147]">Flowboard</h1></div></div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#888888]"><CircleDot className="size-4 text-[#ecad0a]" /> One board, clear focus</div>
        </div>
      </header>
      <section className="mx-auto min-w-[1024px] max-w-[1800px] px-10 py-9">
        <div className="mb-7 flex items-end justify-between"><div><p className="mb-2 text-sm font-semibold text-[#209dd7]">Weekly delivery</p><h2 className="text-3xl font-bold tracking-tight text-[#032147]">Make steady progress, together.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#888888]">A deliberately simple place for the work that matters this week.</p></div><div className="h-1 w-24 rounded-full bg-[#ecad0a]" /></div>
        <DndContext id="flowboard-dnd" sensors={sensors} collisionDetection={collisionDetection} onDragStart={({ active }) => setActiveCard(findCard(String(active.id)))} onDragOver={({ active, over }) => { if (over) moveAcrossColumns(String(active.id), String(over.id)); }} onDragCancel={() => setActiveCard(null)} onDragEnd={({ active, over }) => { if (over) setColumns((current) => moveCard(current, String(active.id), String(over.id))); setActiveCard(null); }}>
          <div className="flex gap-4 overflow-x-auto pb-5" aria-label="Project board">
            {columns.map((column) => <Column key={column.id} column={column} onRename={renameColumn} onAdd={openAdd} onOpenCard={setSelectedCard} />)}
          </div>
          <DragOverlay dropAnimation={null}>{activeCard ? <div className="w-[264px] rotate-1 rounded-xl border-2 border-[#ecad0a] bg-white p-3 shadow-[0_18px_40px_rgba(3,33,71,0.22)]"><p className="text-sm font-semibold text-[#032147]">{activeCard.title}</p></div> : null}</DragOverlay>
        </DndContext>
      </section>

      <Dialog open={Boolean(addColumnId)} onOpenChange={(open) => !open && closeAdd()}><DialogContent><DialogTitle>New card</DialogTitle><DialogDescription>Add just enough detail to make the next action obvious.</DialogDescription><form onSubmit={createCard} className="mt-6 space-y-4"><label className="block text-sm font-semibold text-[#032147]">Title<input autoFocus value={title} onChange={(event) => { setTitle(event.target.value); setError(""); }} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#209dd7] focus:ring-2 focus:ring-[#209dd7]/20" /></label>{error && <p role="alert" className="text-sm font-medium text-[#b42318]">{error}</p>}<label className="block text-sm font-semibold text-[#032147]">Details <span className="font-normal text-[#888888]">(optional)</span><textarea value={details} onChange={(event) => setDetails(event.target.value)} rows={4} className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#209dd7] focus:ring-2 focus:ring-[#209dd7]/20" /></label><div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={closeAdd}>Cancel</Button><Button type="submit" className="gap-2"><Plus className="size-4" /> Add card</Button></div></form></DialogContent></Dialog>

      <Dialog open={Boolean(selectedCard)} onOpenChange={(open) => !open && setSelectedCard(null)}>{selectedCard && <DialogContent><DialogTitle>{selectedCard.title}</DialogTitle><DialogDescription className="whitespace-pre-wrap">{selectedCard.details || "No additional details were added to this card."}</DialogDescription><div className="mt-8 flex justify-between"><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" className="gap-2 text-[#b42318] hover:bg-red-50 hover:text-[#b42318]"><Trash2 className="size-4" /> Delete card</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogTitle className="text-lg font-bold text-[#032147]">Delete this card?</AlertDialogTitle><AlertDialogDescription className="mt-2 block text-sm leading-6 text-[#888888]">This removes “{selectedCard.title}” from the board. This action cannot be undone.</AlertDialogDescription><div className="mt-6 flex justify-end gap-2"><AlertDialogCancel asChild><Button variant="ghost">Cancel</Button></AlertDialogCancel><AlertDialogAction onClick={() => deleteCard(selectedCard.id)}>Delete card</AlertDialogAction></div></AlertDialogContent></AlertDialog><Button onClick={() => setSelectedCard(null)}>Done</Button></div></DialogContent>}</Dialog>
    </main>
  );
}
