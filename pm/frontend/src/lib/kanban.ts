import type { BoardSnapshot } from "@/lib/api";

export type Priority = "low" | "medium" | "high";
export type LabelColor = "yellow" | "blue" | "purple" | "navy" | "gray";

export type Label = {
  id: string;
  name: string;
  color: LabelColor;
};

export const LABEL_COLOR_STYLES: Record<LabelColor, string> = {
  yellow: "bg-[var(--accent-yellow)]/25 text-[var(--navy-dark)]",
  blue: "bg-[var(--primary-blue)]/15 text-[var(--primary-blue)]",
  purple: "bg-[var(--secondary-purple)]/15 text-[var(--secondary-purple)]",
  navy: "bg-[var(--navy-dark)]/10 text-[var(--navy-dark)]",
  gray: "bg-[var(--gray-text)]/15 text-[var(--gray-text)]",
};

export const LABEL_COLORS: LabelColor[] = ["yellow", "blue", "purple", "navy", "gray"];

export type CardPatch = {
  title: string;
  details: string;
  priority: Priority;
  dueDate: string | null;
};

export type Card = {
  id: string;
  title: string;
  details: string;
  priority: Priority;
  dueDate: string | null;
  labelIds: string[];
  columnId?: string;
  position?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type Column = {
  id: string;
  title: string;
  cardIds: string[];
};

export type BoardData = {
  name: string;
  columns: Column[];
  cards: Record<string, Card>;
  labels: Label[];
};

export const boardFromApi = (snapshot: BoardSnapshot): BoardData => ({
  name: snapshot.board.name,
  labels: snapshot.labels,
  columns: snapshot.columns.map((column) => ({
    id: column.id,
    title: column.title,
    cardIds: [...column.cardIds],
  })),
  cards: Object.fromEntries(
    snapshot.cards.map((card) => [
      card.id,
      {
        id: card.id,
        title: card.title,
        details: card.details || "No details yet.",
        priority: card.priority,
        dueDate: card.dueDate,
        labelIds: card.labelIds,
        columnId: card.columnId,
        position: card.position,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
      },
    ])
  ),
});

const isColumnId = (columns: Column[], id: string) =>
  columns.some((column) => column.id === id);

const findColumnId = (columns: Column[], id: string) => {
  if (isColumnId(columns, id)) {
    return id;
  }
  return columns.find((column) => column.cardIds.includes(id))?.id;
};

export const moveCard = (
  columns: Column[],
  activeId: string,
  overId: string
): Column[] => {
  const activeColumnId = findColumnId(columns, activeId);
  const overColumnId = findColumnId(columns, overId);

  if (!activeColumnId || !overColumnId) {
    return columns;
  }

  const activeColumn = columns.find((column) => column.id === activeColumnId);
  const overColumn = columns.find((column) => column.id === overColumnId);

  if (!activeColumn || !overColumn) {
    return columns;
  }

  const isOverColumn = isColumnId(columns, overId);

  if (activeColumnId === overColumnId) {
    if (isOverColumn) {
      const nextCardIds = activeColumn.cardIds.filter(
        (cardId) => cardId !== activeId
      );
      nextCardIds.push(activeId);
      return columns.map((column) =>
        column.id === activeColumnId
          ? { ...column, cardIds: nextCardIds }
          : column
      );
    }

    const oldIndex = activeColumn.cardIds.indexOf(activeId);
    const newIndex = activeColumn.cardIds.indexOf(overId);

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
      return columns;
    }

    const nextCardIds = [...activeColumn.cardIds];
    nextCardIds.splice(oldIndex, 1);
    nextCardIds.splice(newIndex, 0, activeId);

    return columns.map((column) =>
      column.id === activeColumnId
        ? { ...column, cardIds: nextCardIds }
        : column
    );
  }

  const activeIndex = activeColumn.cardIds.indexOf(activeId);
  if (activeIndex === -1) {
    return columns;
  }

  const nextActiveCardIds = [...activeColumn.cardIds];
  nextActiveCardIds.splice(activeIndex, 1);

  const nextOverCardIds = [...overColumn.cardIds];
  if (isOverColumn) {
    nextOverCardIds.push(activeId);
  } else {
    const overIndex = overColumn.cardIds.indexOf(overId);
    const insertIndex = overIndex === -1 ? nextOverCardIds.length : overIndex;
    nextOverCardIds.splice(insertIndex, 0, activeId);
  }

  return columns.map((column) => {
    if (column.id === activeColumnId) {
      return { ...column, cardIds: nextActiveCardIds };
    }
    if (column.id === overColumnId) {
      return { ...column, cardIds: nextOverCardIds };
    }
    return column;
  });
};
