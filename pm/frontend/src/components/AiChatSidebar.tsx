'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import type { ChatHistoryMessage } from '@/lib/api';

type AiChatSidebarProps = {
  onSend: (
    question: string,
    history: ChatHistoryMessage[]
  ) => Promise<{ assistant: string; boardUpdated: boolean }>;
};

export const AiChatSidebar = ({ onSend }: AiChatSidebarProps) => {
  const [messages, setMessages] = useState<ChatHistoryMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boardUpdated, setBoardUpdated] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [isSending]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isSending) {
      return;
    }

    const nextHistory = [...messages, { role: 'user' as const, content: trimmedQuestion }];
    setMessages(nextHistory);
    setQuestion('');
    setError(null);
    setBoardUpdated(false);
    setIsSending(true);

    try {
      const result = await onSend(trimmedQuestion, messages);
      setMessages([...nextHistory, { role: 'assistant', content: result.assistant }]);
      setBoardUpdated(result.boardUpdated);
    } catch (requestError: unknown) {
      setMessages(messages);
      setQuestion(trimmedQuestion);
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'The assistant could not respond. Try again.'
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <aside
      aria-label="AI project assistant"
      className="mx-auto flex h-fit w-full max-w-[420px] flex-col rounded-[28px] border border-[var(--stroke)] bg-white/90 p-5 shadow-[var(--shadow)] backdrop-blur xl:mx-0 xl:max-w-none"
    >
      <div className="flex items-start gap-3 border-b border-[var(--stroke)] pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--secondary-purple)] text-sm font-bold text-white">
          AI
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--navy-dark)]">
            Project assistant
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--gray-text)]">
            Ask questions or make focused board changes.
          </p>
        </div>
      </div>

      <div
        aria-live="polite"
        className="my-4 flex max-h-[380px] min-h-36 flex-col gap-3 overflow-y-auto pr-1"
      >
        {messages.length === 0 ? (
          <p className="rounded-2xl bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--gray-text)]">
            Try “What should we focus on next?” or “Move card-1 to Done.”
          </p>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={
                message.role === 'user'
                  ? 'self-end rounded-2xl rounded-br-md bg-[var(--primary-blue)] px-3 py-2 text-sm leading-5 text-white'
                  : 'self-start rounded-2xl rounded-bl-md bg-[var(--surface)] px-3 py-2 text-sm leading-5 text-[var(--navy-dark)]'
              }
            >
              {message.content}
            </div>
          ))
        )}
        {isSending && (
          <p role="status" className="text-xs font-semibold text-[var(--gray-text)]">
            Thinking about your board...
          </p>
        )}
      </div>

      {boardUpdated && (
        <p role="status" className="mb-3 rounded-xl bg-[var(--accent-yellow)]/15 px-3 py-2 text-xs font-semibold text-[var(--navy-dark)]">
          Board updated from the assistant response.
        </p>
      )}
      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-[var(--secondary-purple)]/10 px-3 py-2 text-xs font-semibold text-[var(--secondary-purple)]">
          {error}
        </p>
      )}

      <form onSubmit={submit} className="border-t border-[var(--stroke)] pt-4">
        <label htmlFor="ai-question" className="sr-only">
          Ask the project assistant
        </label>
        <textarea
          ref={inputRef}
          id="ai-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this board..."
          rows={3}
          disabled={isSending}
          className="w-full resize-none rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-3 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-[var(--primary-blue)]/20 disabled:opacity-60"
        />
        <p className="mt-1.5 text-[11px] leading-4 text-[var(--gray-text)]">
          Enter to send, Shift+Enter for a new line.
        </p>
        <button
          type="submit"
          disabled={isSending || !question.trim()}
          className="mt-3 w-full rounded-full bg-[var(--secondary-purple)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSending ? 'Sending...' : 'Send message'}
        </button>
      </form>
    </aside>
  );
};
