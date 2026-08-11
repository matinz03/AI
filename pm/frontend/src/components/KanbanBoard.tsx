'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  pointerWithin,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { KanbanColumn } from '@/components/KanbanColumn';
import { KanbanCardPreview } from '@/components/KanbanCardPreview';
import { NewColumnForm } from '@/components/NewColumnForm';
import { AiChatSidebar } from '@/components/AiChatSidebar';
import {
  ApiError,
  chatAboutBoard,
  createCard,
  createColumn,
  deleteCard,
  deleteColumn,
  getBoard,
  moveCardRequest,
  renameColumn,
  updateCard,
  type BoardSnapshot,
} from '@/lib/api';
import { boardFromApi, moveCard, type BoardData, type CardPatch, type Priority } from '@/lib/kanban';

type KanbanBoardProps = {
  token: string;
  boardId: string;
  boardName: string;
  onBack: () => void;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Your session is no longer valid. Please sign in again.';
    }
    if (error.status === 404) {
      return 'That board item is no longer available. Refresh and try again.';
    }
    return error.message;
  }
  return 'The board could not be updated. Check the backend and try again.';
};

const getLoadErrorMessage = (error: unknown) => {
  if (error instanceof ApiError && error.status === 401) {
    return 'Your session is no longer valid. Please sign in again.';
  }
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'The board could not be loaded. Check the backend and try again.';
};

export const KanbanBoard = ({ token, boardId, boardName, onBack }: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    getBoard(token, boardId, controller.signal)
      .then((snapshot) => setBoard(boardFromApi(snapshot)))
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') {
          return;
        }
        setError(getLoadErrorMessage(requestError));
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [loadAttempt, token, boardId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const cardsById = useMemo(() => board?.cards ?? {}, [board?.cards]);

  const collisionDetection: CollisionDetection = (args) => {
    const emptyColumnCollision = pointerWithin(args).find(
      ({ id }) =>
        args.droppableContainers.find((container) => container.id === id)?.data
          .current?.isEmpty
    );

    return emptyColumnCollision ? [emptyColumnCollision] : closestCorners(args);
  };

  const persist = async (
    mutation: () => Promise<BoardSnapshot>,
    rollback?: () => void
  ): Promise<boolean> => {
    setIsMutating(true);
    setError(null);
    try {
      const snapshot = await mutation();
      setBoard(boardFromApi(snapshot));
      return true;
    } catch (requestError: unknown) {
      rollback?.();
      setError(getErrorMessage(requestError));
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!board || !over || active.id === over.id || isMutating) {
      return;
    }

    const activeId = active.id as string;
    const nextColumns = moveCard(board.columns, activeId, over.id as string);
    if (nextColumns === board.columns) {
      return;
    }

    const targetColumn = nextColumns.find((column) =>
      column.cardIds.includes(activeId)
    );
    if (!targetColumn) {
      return;
    }

    const previousBoard = board;
    setBoard({ ...board, columns: nextColumns });
    void persist(
      () =>
        moveCardRequest(
          token,
          boardId,
          activeId,
          targetColumn.id,
          targetColumn.cardIds.indexOf(activeId)
        ),
      () => setBoard(previousBoard)
    );
  };

  const handleRenameColumn = (columnId: string, title: string) =>
    persist(() => renameColumn(token, boardId, columnId, title));

  const handleAddColumn = (title: string) =>
    persist(() => createColumn(token, boardId, title));

  const handleDeleteColumn = (columnId: string) => {
    void persist(() => deleteColumn(token, boardId, columnId));
  };

  const handleAddCard = (
    columnId: string,
    title: string,
    details: string,
    priority: Priority,
    dueDate: string | null
  ) => persist(() => createCard(token, boardId, columnId, title, details, priority, dueDate));

  const handleUpdateCard = (cardId: string, patch: CardPatch) =>
    persist(() =>
      updateCard(token, boardId, cardId, {
        title: patch.title,
        details: patch.details,
        priority: patch.priority,
        dueDate: patch.dueDate ?? undefined,
        clearDueDate: patch.dueDate === null,
      })
    );

  const handleDeleteCard = (_columnId: string, cardId: string) => {
    void persist(() => deleteCard(token, boardId, cardId));
  };

  const handleChat = async (
    question: string,
    history: Parameters<typeof chatAboutBoard>[3]
  ) => {
    const response = await chatAboutBoard(token, boardId, question, history);
    const nextBoard = boardFromApi(response);
    const boardUpdated =
      board !== null &&
      (JSON.stringify(board.columns) !== JSON.stringify(nextBoard.columns) ||
        JSON.stringify(board.cards) !== JSON.stringify(nextBoard.cards));
    setBoard(nextBoard);
    return { assistant: response.assistant, boardUpdated };
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <p role="status" className="text-sm font-semibold text-[var(--gray-text)]">
          Loading your board...
        </p>
      </main>
    );
  }

  if (!board) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <section className="w-full max-w-md rounded-[32px] border border-[var(--stroke)] bg-white p-8 shadow-[var(--shadow)]">
          <p role="alert" className="text-sm font-semibold text-[var(--secondary-purple)]">
            {error ?? 'The board could not be loaded.'}
          </p>
          <button
            type="button"
            onClick={() => setLoadAttempt((attempt) => attempt + 1)}
            className="mt-6 rounded-full bg-[var(--secondary-purple)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:brightness-110"
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1680px] flex-col gap-10 px-6 pb-16 pt-12">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <button
                type="button"
                onClick={onBack}
                className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--primary-blue)] transition hover:text-[var(--navy-dark)]"
              >
                {'←'} All boards
              </button>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                {board.name || boardName}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Add or rename columns, drag cards
                between stages, and track priority and due dates without
                getting buried in settings.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                Focus
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                {board.columns.length} columns. {Object.keys(board.cards).length} cards.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
          </div>
          {error && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--secondary-purple)]/20 bg-[var(--secondary-purple)]/5 px-4 py-3">
              <p role="alert" className="text-sm font-semibold text-[var(--secondary-purple)]">
                {error}
              </p>
              <button
                type="button"
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                className="rounded-full border border-[var(--secondary-purple)]/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--secondary-purple)]"
              >
                Refresh board
              </button>
            </div>
          )}
          <div className="min-h-5" aria-live="polite">
            {isMutating && (
              <p role="status" className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                Saving board changes...
              </p>
            )}
          </div>
        </header>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <section className="flex min-w-0 snap-x gap-5 overflow-x-auto pb-2">
              {board.columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={column.cardIds.map((cardId) => board.cards[cardId]).filter(Boolean)}
                  onRename={handleRenameColumn}
                  onDeleteColumn={handleDeleteColumn}
                  onAddCard={handleAddCard}
                  onDeleteCard={handleDeleteCard}
                  onUpdateCard={handleUpdateCard}
                />
              ))}
              <NewColumnForm onAdd={handleAddColumn} />
            </section>
            <DragOverlay>
              {activeCard ? (
                <div className="w-[260px]">
                  <KanbanCardPreview card={activeCard} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
          <AiChatSidebar onSend={handleChat} />
        </div>
      </main>
    </div>
  );
};
