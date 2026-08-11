import { useState, type FormEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card, CardPatch, Label, Priority } from "@/lib/kanban";
import { LABEL_COLOR_STYLES } from "@/lib/kanban";
import { PencilIcon, TrashIcon } from "@/components/icons";

type KanbanCardProps = {
  card: Card;
  labels: Label[];
  onDelete: (cardId: string) => void;
  onUpdate: (cardId: string, patch: CardPatch) => Promise<boolean>;
  onToggleLabel: (cardId: string, labelId: string) => void;
};

const PRIORITY_STYLES: Record<Priority, string> = {
  low: "bg-[var(--surface)] text-[var(--gray-text)]",
  medium: "bg-[var(--primary-blue)]/10 text-[var(--primary-blue)]",
  high: "bg-[var(--secondary-purple)]/10 text-[var(--secondary-purple)]",
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export const KanbanCard = ({ card, labels, onDelete, onUpdate, onToggleLabel }: KanbanCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [details, setDetails] = useState(card.details);
  const [priority, setPriority] = useState<Priority>(card.priority);
  const [dueDate, setDueDate] = useState(card.dueDate ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOverdue = card.dueDate !== null && card.dueDate < todayIso();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving || !title.trim()) {
      return;
    }
    setIsSaving(true);
    try {
      const didSave = await onUpdate(card.id, {
        title: title.trim(),
        details: details.trim(),
        priority,
        dueDate: dueDate || null,
      });
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
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                className="text-[11px] font-semibold uppercase tracking-wide text-[var(--gray-text)]"
                htmlFor={`edit-priority-${card.id}`}
              >
                Priority
              </label>
              <select
                id={`edit-priority-${card.id}`}
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
                className="mt-1 w-full rounded-xl border border-[var(--stroke)] bg-white px-2 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label
                className="text-[11px] font-semibold uppercase tracking-wide text-[var(--gray-text)]"
                htmlFor={`edit-due-date-${card.id}`}
              >
                Due date
              </label>
              <input
                id={`edit-due-date-${card.id}`}
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--stroke)] bg-white px-2 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
              />
            </div>
          </div>
          {labels.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--gray-text)]">
                Labels
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {labels.map((label) => (
                  <label
                    key={label.id}
                    className={clsx(
                      "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                      LABEL_COLOR_STYLES[label.color]
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={card.labelIds.includes(label.id)}
                      onChange={() => onToggleLabel(card.id, label.id)}
                    />
                    {label.name}
                  </label>
                ))}
              </div>
            </div>
          )}
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
                setPriority(card.priority);
                setDueDate(card.dueDate ?? "");
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
          <div className="flex items-start justify-between gap-2">
            <h4 className="break-words font-display text-base font-semibold text-[var(--navy-dark)]">
              {card.title}
            </h4>
            <span
              className={clsx(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                PRIORITY_STYLES[card.priority]
              )}
            >
              {card.priority}
            </span>
          </div>
          {card.labelIds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {labels
                .filter((label) => card.labelIds.includes(label.id))
                .map((label) => (
                  <span
                    key={label.id}
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      LABEL_COLOR_STYLES[label.color]
                    )}
                  >
                    {label.name}
                  </span>
                ))}
            </div>
          )}
          <p className="mt-2 break-words text-sm leading-6 text-[var(--gray-text)]">
            {card.details}
          </p>
          {card.dueDate && (
            <p
              className={clsx(
                "mt-2 text-xs font-semibold",
                isOverdue ? "text-[var(--secondary-purple)]" : "text-[var(--gray-text)]"
              )}
            >
              Due {card.dueDate}
              {isOverdue ? " (overdue)" : ""}
            </p>
          )}
          <div className="mt-3 flex items-center justify-end gap-1 border-t border-[var(--stroke)] pt-3">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--primary-blue)] transition hover:bg-[var(--surface)]"
              aria-label={`Edit ${card.title}`}
              title="Edit"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(card.id)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
              aria-label={`Delete ${card.title}`}
              title="Delete"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </article>
  );
};
