import { expect, test } from "@playwright/test";

test("runs the primary board workflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Backlog" })).toBeVisible();

  await page.getByRole("button", { name: "Rename Backlog" }).click();
  await page.getByRole("textbox", { name: "Column title" }).fill("Ideas");
  await page.getByRole("textbox", { name: "Column title" }).press("Enter");
  await expect(page.getByRole("heading", { name: "Ideas" })).toBeVisible();

  await page.getByRole("region", { name: "Ideas column" }).getByRole("button", { name: "Add card" }).click();
  await page.getByRole("textbox", { name: "Title" }).fill("Prepare sprint demo");
  await page.getByRole("button", { name: "Add card" }).click();
  await expect(page.getByText("Prepare sprint demo")).toBeVisible();

  const dragHandle = page.getByRole("button", { name: "Drag Prepare sprint demo" });
  const destination = page.getByRole("region", { name: "In progress column" });
  const sourceBox = await dragHandle.boundingBox();
  const destinationBox = await destination.boundingBox();
  if (!sourceBox || !destinationBox) throw new Error("Drag source or destination was not visible");
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 12, sourceBox.y + sourceBox.height / 2, { steps: 3 });
  await page.mouse.move(destinationBox.x + destinationBox.width / 2, destinationBox.y + destinationBox.height - 50, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByRole("region", { name: "In progress column" }).getByText("Prepare sprint demo")).toBeVisible();

  await page.getByRole("region", { name: "In progress column" }).getByRole("button", { name: "Prepare sprint demo", exact: true }).click();
  await page.getByRole("button", { name: "Delete card" }).click();
  await page.getByRole("button", { name: "Delete card" }).click();
  await expect(page.getByRole("region", { name: "In progress column" }).getByText("Prepare sprint demo")).not.toBeVisible();
});
