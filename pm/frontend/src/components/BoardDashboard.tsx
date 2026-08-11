'use client';

import { useCallback, useEffect, useState, type FocusEvent, type FormEvent } from 'react';
import {
  ApiError,
  createBoard,
  deleteBoard,
  listBoards,
  renameBoard,
  type BoardSummary,
} from '@/lib/api';
import { TrashIcon } from '@/components/icons';

type BoardDashboardProps = {
  token: string;
  onOpenBoard: (board: { id: string; name: string }) => void;
};

export const BoardDashboard = ({ token, onOpenBoard }: BoardDashboardProps) => {
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newBoardName, setNewBoardName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await listBoards(token);
      setBoards(response.boards);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Your boards could not be loaded. Check the backend and try again.'
      );
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newBoardName.trim();
    if (!name || isCreating) {
      return;
    }
    setIsCreating(true);
    try {
      await createBoard(token, name);
      setNewBoardName('');
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'The board could not be created.'
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleRename = async (event: FocusEvent<HTMLInputElement>, board: BoardSummary) => {
    const nextName = event.currentTarget.value.trim();
    if (!nextName) {
      event.currentTarget.value = board.name;
      return;
    }
    if (nextName === board.name) {
      return;
    }
    try {
      await renameBoard(token, board.id, nextName);
      await load();
    } catch {
      event.currentTarget.value = board.name;
      setError('The board could not be renamed.');
    }
  };

  const handleDelete = async (board: BoardSummary) => {
    try {
      await deleteBoard(token, board.id);
      await load();
    } catch {
      setError('The board could not be deleted.');
    }
  };

  if (boards === null && !error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <p role="status" className="text-sm font-semibold text-[var(--gray-text)]">
          Loading your boards...
        </p>
      </main>
    );
  }

  return (
    <main className="relative mx-auto flex min-h-screen max-w-[1680px] flex-col gap-8 px-6 pb-16 pt-8">
      <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
            Project Management
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
            Your boards
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
            Open an existing board or start a new one for a different project.
          </p>
        </div>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <label
              htmlFor="new-board-name"
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]"
            >
              New board name
            </label>
            <input
              id="new-board-name"
              value={newBoardName}
              onChange={(event) => setNewBoardName(event.target.value)}
              placeholder="e.g. Marketing launch"
              className="mt-2 w-full max-w-sm rounded-xl border border-[var(--stroke)] bg-white px-3 py-3 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isCreating}
            className="rounded-full bg-[var(--secondary-purple)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCreating ? 'Creating...' : 'Create board'}
          </button>
        </form>
        {error && (
          <p role="alert" className="text-sm font-semibold text-[var(--secondary-purple)]">
            {error}
          </p>
        )}
      </header>

      {boards && boards.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--stroke)] px-6 py-10 text-center text-sm font-semibold text-[var(--gray-text)]">
          No boards yet. Create your first one above.
        </p>
      ) : (
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {boards?.map((board) => (
            <article
              key={board.id}
              data-testid={`board-card-${board.id}`}
              className="flex flex-col justify-between gap-4 rounded-3xl border border-[var(--stroke)] bg-white/90 p-5 shadow-[var(--shadow)]"
            >
              <div>
                <label className="sr-only" htmlFor={`board-name-${board.id}`}>
                  Board name
                </label>
                <input
                  id={`board-name-${board.id}`}
                  key={`${board.id}-${board.name}`}
                  defaultValue={board.name}
                  onBlur={(event) => void handleRename(event, board)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur();
                    }
                  }}
                  className="w-full bg-transparent font-display text-lg font-semibold text-[var(--navy-dark)] outline-none"
                />
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                  {board.cardCount} {board.cardCount === 1 ? 'card' : 'cards'}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onOpenBoard({ id: board.id, name: board.name })}
                  className="rounded-full bg-[var(--primary-blue)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
                >
                  Open board
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(board)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
                  aria-label={`Delete ${board.name}`}
                  title="Delete"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
};
