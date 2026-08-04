import { useState, type FormEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
  onUpdate: (cardId: string, title: string, details: string) => Promise<boolean>;
};

export const KanbanCard = ({ card, onDelete, onUpdate }: KanbanCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [details, setDetails] = useState(card.details);
  const [isSaving, setIsSaving] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving || !title.trim()) {
      return;
    }
    setIsSaving(true);
    try {
      const didSave = await onUpdate(card.id, title.trim(), details.trim());
      if (didSave) {
        setIsEditing(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_12px_24px_rgba(3,33,71,0.08)]",
        "transition-all duration-150",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      {...attributes}
      {...listeners}
      data-testid={`card-${card.id}`}
    >
      {isEditing ? (
        <form
          onSubmit={handleSubmit}
          onPointerDown={(event) => event.stopPropagation()}
          className="space-y-3"
        >
          <label className="sr-only" htmlFor={`edit-title-${card.id}`}>
            Card title
          </label>
          <input
            id={`edit-title-${card.id}`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-semibold text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
            required
          />
          <label className="sr-only" htmlFor={`edit-details-${card.id}`}>
            Card details
          </label>
          <textarea
            id={`edit-details-${card.id}`}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--gray-text)] outline-none focus:border-[var(--primary-blue)]"
          />
          <div className="grid grid-cols-2 gap-2 border-t border-[var(--stroke)] pt-3">
            <button
              type="submit"
              disabled={isSaving}
              aria-label="Save changes"
              className="w-full rounded-xl bg-[var(--secondary-purple)] px-2 py-2 text-xs font-semibold text-white transition hover:brightness-110"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setTitle(card.title);
                setDetails(card.details);
                setIsEditing(false);
              }}
              className="w-full rounded-xl border border-[var(--stroke)] px-2 py-2 text-xs font-semibold text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="min-w-0">
            <h4 className="break-words font-display text-base font-semibold text-[var(--navy-dark)]">
              {card.title}
            </h4>
            <p className="mt-2 break-words text-sm leading-6 text-[var(--gray-text)]">
              {card.details}
            </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--stroke)] pt-3">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-full border border-transparent px-3 py-1.5 text-xs font-semibold text-[var(--primary-blue)] transition hover:border-[var(--stroke)]"
              aria-label={`Edit ${card.title}`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(card.id)}
              className="rounded-full border border-transparent px-3 py-1.5 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[var(--navy-dark)]"
              aria-label={`Delete ${card.title}`}
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </article>
  );
};
