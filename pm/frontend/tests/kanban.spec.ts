import { expect, test, type Page } from '@playwright/test';

const createMockBoard = () => ({
  board: {
    id: 'board-default',
    userId: 'user-default',
    name: 'Product roadmap',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  columns: [
    { id: 'col-backlog', title: 'Backlog', position: 0, cardIds: ['card-1', 'card-2'] },
    { id: 'col-discovery', title: 'Discovery', position: 1, cardIds: ['card-3'] },
    { id: 'col-progress', title: 'In Progress', position: 2, cardIds: ['card-4', 'card-5'] },
    { id: 'col-review', title: 'Review', position: 3, cardIds: ['card-6'] },
    { id: 'col-done', title: 'Done', position: 4, cardIds: ['card-7', 'card-8'] },
  ],
  cards: [
    ['card-1', 'col-backlog', 'Align roadmap themes', 'Draft quarterly themes with impact statements and metrics.'],
    ['card-2', 'col-backlog', 'Gather customer signals', 'Review support tags, sales notes, and churn feedback.'],
    ['card-3', 'col-discovery', 'Prototype analytics view', 'Sketch initial dashboard layout and key drill-downs.'],
    ['card-4', 'col-progress', 'Refine status language', 'Standardize column labels and tone across the board.'],
    ['card-5', 'col-progress', 'Design card layout', 'Add hierarchy and spacing for scanning dense lists.'],
    ['card-6', 'col-review', 'QA micro-interactions', 'Verify hover, focus, and loading states.'],
    ['card-7', 'col-done', 'Ship marketing page', 'Final copy approved and asset pack delivered.'],
    ['card-8', 'col-done', 'Close onboarding sprint', 'Document release notes and share internally.'],
  ].map(([id, columnId, title, details], position) => ({
    id,
    columnId,
    title,
    details,
    position,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  })),
});

test.beforeEach(async ({ page }) => {
  if (process.env.PM_E2E_REAL_API === 'true') {
    return;
  }

  const board = createMockBoard();

  await page.route('**/api/users/user/board**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const body = request.postDataJSON() as Record<string, string | number> | null;
    const cardId = pathname.split('/').pop();

    if (request.method() === 'PATCH' && pathname.includes('/columns/')) {
      const column = board.columns.find((candidate) => candidate.id === cardId);
      if (column && typeof body?.title === 'string') {
        column.title = body.title;
      }
    } else if (request.method() === 'POST' && pathname.endsWith('/cards')) {
      const column = board.columns.find((candidate) => candidate.id === body?.columnId);
      const newCard = {
        id: 'card-new',
        columnId: String(body?.columnId),
        title: String(body?.title),
        details: String(body?.details ?? ''),
        position: column?.cardIds.length ?? 0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      board.cards.push(newCard);
      column?.cardIds.push(newCard.id);
    } else if (request.method() === 'PATCH' && pathname.includes('/cards/')) {
      const card = board.cards.find((candidate) => candidate.id === cardId);
      if (card) {
        card.title = String(body?.title ?? card.title);
        card.details = String(body?.details ?? card.details);
      }
    } else if (request.method() === 'POST' && pathname.endsWith('/move')) {
      const movedCardId = pathname.split('/').at(-2);
      const card = board.cards.find((candidate) => candidate.id === movedCardId);
      const targetColumn = board.columns.find((candidate) => candidate.id === body?.columnId);
      if (card && targetColumn) {
        board.columns.forEach((column) => {
          column.cardIds = column.cardIds.filter((id) => id !== movedCardId);
        });
        targetColumn.cardIds.splice(Number(body?.position ?? targetColumn.cardIds.length), 0, movedCardId);
        card.columnId = targetColumn.id;
      }
    } else if (request.method() === 'DELETE' && pathname.includes('/cards/')) {
      board.cards = board.cards.filter((candidate) => candidate.id !== cardId);
      board.columns.forEach((column) => {
        column.cardIds = column.cardIds.filter((id) => id !== cardId);
      });
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(board),
    });
  });
});

const signIn = async (page: Page) => {
  await page.getByLabel('Username').fill('user');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: 'Kanban Studio' })
  ).toBeVisible();
};

test('requires sign-in before showing the board', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Kanban Studio' })
  ).not.toBeVisible();
});

test('rejects invalid credentials', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Username').fill('wrong');
  await page.getByLabel('Password').fill('credentials');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByText('Invalid username or password.', { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Kanban Studio' })
  ).not.toBeVisible();
});

test('logs out and returns to sign-in', async ({ page }) => {
  await page.goto('/');
  await signIn(page);
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('loads the kanban board', async ({ page }) => {
  await page.goto('/');
  await signIn(page);
  await expect(
    page.getByRole('heading', { name: 'Kanban Studio' })
  ).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test('adds a card to a column', async ({ page }) => {
  await page.goto('/');
  await signIn(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole('button', { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder('Card title').fill('Playwright card');
  await firstColumn.getByPlaceholder('Details').fill('Added via e2e.');
  await firstColumn.getByRole('button', { name: /add card/i }).click();
  await expect(firstColumn.getByText('Playwright card')).toBeVisible();
});

test('edits a card and reloads the persisted snapshot', async ({ page }) => {
  await page.goto('/');
  await signIn(page);
  const card = page.getByTestId('card-card-1');
  await card.getByRole('button', { name: 'Edit Align roadmap themes', exact: true }).click();
  await page.locator('#edit-title-card-1').fill('Updated roadmap themes');
  await page.locator('#edit-details-card-1').fill('Updated through the backend API.');
  await card.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(card.getByText('Updated roadmap themes')).toBeVisible();
  await expect(card.getByText('Updated through the backend API.')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('card-card-1').getByText('Updated roadmap themes')).toBeVisible();
});

test('moves a card into an empty column', async ({ page }) => {
  await page.goto('/');
  await signIn(page);
  const targetColumn = page.getByTestId('column-col-discovery');
  await targetColumn
    .getByRole('button', { name: 'Delete Prototype analytics view', exact: true })
    .click();
  await expect(targetColumn.getByText('Drop a card here')).toBeVisible();

  const card = page.getByTestId('card-card-1');
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error('Unable to resolve drag coordinates.');
  }

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(columnBox.x + columnBox.width / 2, columnBox.y + 120, {
    steps: 12,
  });
  await page.mouse.up();
  await expect(targetColumn.getByTestId('card-card-1')).toBeVisible();
});
