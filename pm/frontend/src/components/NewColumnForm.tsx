import { useState, type FormEvent } from "react";

type NewColumnFormProps = {
  onAdd: (title: string) => Promise<boolean>;
};

export const NewColumnForm = ({ onAdd }: NewColumnFormProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }
    setIsSubmitting(true);
    const didAdd = await onAdd(title.trim());
    setIsSubmitting(false);
    if (didAdd) {
      setTitle("");
      setIsOpen(false);
    }
  };

  return (
    <div className="flex min-h-[520px] min-w-[230px] max-w-[300px] flex-1 shrink-0 snap-start flex-col rounded-3xl border border-dashed border-[var(--stroke)] p-4">
      {isOpen ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="sr-only" htmlFor="new-column-title">
            New column name
          </label>
          <input
            id="new-column-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Column name"
            className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
            required
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
            >
              {isSubmitting ? "Adding..." : "Add column"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setTitle("");
              }}
              className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex flex-1 items-center justify-center rounded-2xl text-xs font-semibold uppercase tracking-wide text-[var(--primary-blue)] transition hover:bg-[var(--surface)]"
        >
          + Add column
        </button>
      )}
    </div>
  );
};
