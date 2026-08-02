export type Card = {
  id: string;
  title: string;
  details: string;
};

export type Column = {
  id: string;
  title: string;
  cards: Card[];
};

export const initialColumns: Column[] = [
  {
    id: "backlog",
    title: "Backlog",
    cards: [
      { id: "card-1", title: "Map the onboarding journey", details: "Outline the first-session experience and identify the moments that need the clearest guidance." },
      { id: "card-2", title: "Collect launch screenshots", details: "Select product moments for the website and the announcement." },
    ],
  },
  {
    id: "ready",
    title: "Ready to start",
    cards: [
      { id: "card-3", title: "Refine the navigation", details: "Simplify the main paths and check keyboard focus states." },
      { id: "card-4", title: "Draft customer update", details: "Write a concise note explaining the next release." },
    ],
  },
  {
    id: "progress",
    title: "In progress",
    cards: [
      { id: "card-5", title: "Build the project overview", details: "Create the team’s at-a-glance workspace for weekly planning." },
    ],
  },
  {
    id: "review",
    title: "In review",
    cards: [
      { id: "card-6", title: "Review empty states", details: "Check that every quiet screen explains the next useful action." },
    ],
  },
  {
    id: "done",
    title: "Done",
    cards: [
      { id: "card-7", title: "Set the project rhythm", details: "Document the weekly planning and review cadence." },
    ],
  },
];

export function moveCard(columns: Column[], activeId: string, overId: string): Column[] {
  const activeColumnIndex = columns.findIndex((column) => column.cards.some((card) => card.id === activeId));
  const overColumnIndex = columns.findIndex(
    (column) => column.id === overId || column.cards.some((card) => card.id === overId),
  );

  if (activeColumnIndex < 0 || overColumnIndex < 0) return columns;

  const activeColumn = columns[activeColumnIndex];
  const activeCardIndex = activeColumn.cards.findIndex((card) => card.id === activeId);
  const overCardIndex = activeColumnIndex === overColumnIndex
    ? activeColumn.cards.findIndex((card) => card.id === overId)
    : -1;
  const activeCard = activeColumn.cards[activeCardIndex];
  const next = columns.map((column) => ({ ...column, cards: [...column.cards] }));

  next[activeColumnIndex].cards.splice(activeCardIndex, 1);
  const destination = next[overColumnIndex];
  const targetIndex = destination.cards.findIndex((card) => card.id === overId);
  const insertionIndex = overCardIndex >= 0 ? overCardIndex : targetIndex < 0 ? destination.cards.length : targetIndex;
  destination.cards.splice(insertionIndex, 0, activeCard);
  return next;
}
