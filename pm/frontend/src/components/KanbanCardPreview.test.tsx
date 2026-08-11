import { render, screen } from "@testing-library/react";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import type { Card } from "@/lib/kanban";

const card: Card = {
  id: "card-1",
  title: "Preview card",
  details: "Some details.",
  priority: "medium",
  dueDate: null,
};

describe("KanbanCardPreview", () => {
  it("renders the card's title and details", () => {
    render(<KanbanCardPreview card={card} />);

    expect(screen.getByText("Preview card")).toBeInTheDocument();
    expect(screen.getByText("Some details.")).toBeInTheDocument();
  });
});
