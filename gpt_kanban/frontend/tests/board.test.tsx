import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Board } from "@/components/board/board";
import { initialColumns, moveCard } from "@/lib/board";

describe("Flowboard", () => {
  it("renders the fixed five seeded columns", () => {
    render(<Board />);
    expect(screen.getByRole("heading", { name: "Backlog" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Done" })).toBeInTheDocument();
    expect(screen.getAllByRole("region")).toHaveLength(5);
  });

  it("renames a column inline", async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(screen.getByRole("button", { name: "Rename Backlog" }));
    await user.clear(screen.getByRole("textbox", { name: "Column title" }));
    await user.type(screen.getByRole("textbox", { name: "Column title" }), "Ideas");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "Ideas" })).toBeInTheDocument();
  });

  it("validates and creates a card", async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(screen.getAllByRole("button", { name: "Add card" })[0]);
    await user.click(screen.getByRole("button", { name: "Add card" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Give this card a title");
    await user.type(screen.getByRole("textbox", { name: "Title" }), "Plan team retro");
    await user.click(screen.getByRole("button", { name: "Add card" }));
    expect(screen.getByText("Plan team retro")).toBeInTheDocument();
  });

  it("shows card details and deletes after confirmation", async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(screen.getByRole("heading", { name: "Map the onboarding journey" }));
    expect(screen.getAllByText(/Outline the first-session experience/)).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Delete card" }));
    await user.click(screen.getByRole("button", { name: "Delete card" }));
    expect(screen.queryByText("Map the onboarding journey")).not.toBeInTheDocument();
  });

  it("moves a card into another column in local state", () => {
    const next = moveCard(initialColumns, "card-1", "progress");
    expect(next.find((column) => column.id === "backlog")?.cards.some((card) => card.id === "card-1")).toBe(false);
    expect(next.find((column) => column.id === "progress")?.cards.at(-1)?.id).toBe("card-1");
  });
});
