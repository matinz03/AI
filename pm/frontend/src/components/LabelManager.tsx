import { useState, type FormEvent } from "react";
import clsx from "clsx";
import { LABEL_COLORS, LABEL_COLOR_STYLES, type Label, type LabelColor } from "@/lib/kanban";

type LabelManagerProps = {
  labels: Label[];
  onCreate: (name: string, color: LabelColor) => Promise<boolean>;
  onDelete: (labelId: string) => void;
};

export const LabelManager = ({ labels, onCreate, onDelete }: LabelManagerProps) => {
  const [name, setName] = useState("");
  const [color, setColor] = useState<LabelColor>("blue");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    const didAdd = await onCreate(name.trim(), color);
    setIsSubmitting(false);
    if (didAdd) {
      setName("");
    }
  };

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
        Labels
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {labels.map((label) => (
          <span
            key={label.id}
            className={clsx(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              LABEL_COLOR_STYLES[label.color]
            )}
          >
            {label.name}
            <button
              type="button"
              onClick={() => onDelete(label.id)}
              aria-label={`Delete label ${label.name}`}
              className="text-current opacity-60 transition hover:opacity-100"
            >
              &times;
            </button>
          </span>
        ))}
        {labels.length === 0 && (
          <span className="text-xs text-[var(--gray-text)]">No labels yet.</span>
        )}
      </div>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="new-label-name">
          New label name
        </label>
        <input
          id="new-label-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New label"
          className="w-36 rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
        />
        <label className="sr-only" htmlFor="new-label-color">
          Label color
        </label>
        <select
          id="new-label-color"
          value={color}
          onChange={(event) => setColor(event.target.value as LabelColor)}
          className="rounded-xl border border-[var(--stroke)] bg-white px-2 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
        >
          {LABEL_COLORS.map((option) => (
            <option key={option} value={option}>
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--primary-blue)] transition hover:border-[var(--primary-blue)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Adding..." : "Add label"}
        </button>
      </form>
    </div>
  );
};
