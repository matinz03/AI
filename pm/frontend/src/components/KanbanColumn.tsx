import clsx from 'clsx';
import type { FocusEvent } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Card, CardPatch, Column, Label, Priority } from '@/lib/kanban';
import { KanbanCard } from '@/components/KanbanCard';
import { NewCardForm } from '@/components/NewCardForm';
import { TrashIcon } from '@/components/icons';

type KanbanColumnProps = {
  column: Column;
  cards: Card[];
  totalCardCount: number;
  isSearching: boolean;
  labels: Label[];
  onRename: (columnId: string, title: string) => Promise<boolean>;
  onDeleteColumn: (columnId: string) => void;
  onAddCard: (
    columnId: string,
    title: string,
    details: string,
    priority: Priority,
    dueDate: string | null
  ) => Promise<boolean>;
  onDeleteCard: (columnId: string, cardId: string) => void;
  onUpdateCard: (cardId: string, patch: CardPatch) => Promise<boolean>;
  onToggleLabel: (cardId: string, labelId: string) => void;
};

export const KanbanColumn = ({
  column,
  cards,
  totalCardCount,
  isSearching,
  labels,
  onRename,
  onDeleteColumn,
  onAddCard,
  onDeleteCard,
  onUpdateCard,
  onToggleLabel,
}: KanbanColumnProps) => {
  const commitTitle = (event: FocusEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const nextTitle = input.value.trim();
    if (!nextTitle) {
      input.value = column.title;
      return;
    }
    if (nextTitle !== column.title) {
      void onRename(column.id, nextTitle).then((didSave) => {
        if (!didSave) {
          input.value = column.title;
        }
      });
    }
  };
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { isEmpty: totalCardCount === 0 },
  });

  return (
    <section
      ref={setNodeRef}
      className={clsx(
        'flex min-h-[520px] min-w-[230px] max-w-[300px] flex-1 snap-start flex-col rounded-3xl border border-[var(--stroke)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow)] transition',
        isOver && 'ring-2 ring-[var(--accent-yellow)]'
      )}
      data-testid={`column-${column.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-full">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-2 w-10 rounded-full bg-[var(--accent-yellow)]" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                {totalCardCount} cards
              </span>
            </div>
            <button
              type="button"
              onClick={() => onDeleteColumn(column.id)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
              aria-label={`Delete ${column.title} column`}
              title="Delete column"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <input
            key={`${column.id}-${column.title}`}
            defaultValue={column.title}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur();
              }
            }}
            className="mt-3 w-full bg-transparent font-display text-lg font-semibold text-[var(--navy-dark)] outline-none"
            aria-label="Column title"
          />
        </div>
      </div>
      <div className="mt-4 flex flex-1 flex-col gap-3">
        <SortableContext
          items={cards.map((card) => card.id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              labels={labels}
              onDelete={(cardId) => onDeleteCard(column.id, cardId)}
              onUpdate={onUpdateCard}
              onToggleLabel={onToggleLabel}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--stroke)] px-3 py-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            {isSearching ? 'No matching cards' : 'Drop a card here'}
          </div>
        )}
      </div>
      <NewCardForm
        onAdd={(title, details, priority, dueDate) =>
          onAddCard(column.id, title, details, priority, dueDate)
        }
      />
    </section>
  );
};
