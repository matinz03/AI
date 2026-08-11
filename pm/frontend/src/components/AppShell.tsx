'use client';

import { useState } from 'react';
import { BoardDashboard } from '@/components/BoardDashboard';
import { KanbanBoard } from '@/components/KanbanBoard';
import type { AuthSession } from '@/lib/api';

type AppShellProps = {
  session: AuthSession;
  onLogout: () => void;
};

export const AppShell = ({ session, onLogout }: AppShellProps) => {
  const [activeBoard, setActiveBoard] = useState<{ id: string; name: string } | null>(null);

  return (
    <div className="relative">
      <div className="relative z-10 mx-auto flex max-w-[1680px] items-center justify-between px-6 pt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
          Signed in as {session.username}
        </p>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:border-[var(--primary-blue)] hover:text-[var(--navy-dark)]"
        >
          Log out
        </button>
      </div>
      {activeBoard ? (
        <KanbanBoard
          token={session.token}
          boardId={activeBoard.id}
          boardName={activeBoard.name}
          onBack={() => setActiveBoard(null)}
        />
      ) : (
        <BoardDashboard token={session.token} onOpenBoard={setActiveBoard} />
      )}
    </div>
  );
};
