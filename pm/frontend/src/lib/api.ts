import type { Label, LabelColor, Priority } from "@/lib/kanban";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiColumn = {
  id: string;
  title: string;
  position: number;
  cardIds: string[];
};

export type ApiCard = {
  id: string;
  columnId: string;
  title: string;
  details: string;
  priority: Priority;
  dueDate: string | null;
  labelIds: string[];
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type BoardSnapshot = {
  board: {
    id: string;
    userId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
  };
  columns: ApiColumn[];
  cards: ApiCard[];
  labels: Label[];
};

export type BoardSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  cardCount: number;
};

export type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type BoardChatResponse = BoardSnapshot & {
  assistant: string;
};

export type AuthSession = {
  token: string;
  username: string;
};

export type CardPatch = {
  title?: string;
  details?: string;
  priority?: Priority;
  dueDate?: string;
  clearDueDate?: boolean;
};

export const apiRequest = async <T>(
  path: string,
  options?: RequestInit
): Promise<T> => {
  const normalizedPath = path.replace(/^\/+/, "");
  const response = await fetch(`/api/${normalizedPath}`, options);

  if (!response.ok) {
    let detail: string | undefined;
    if (typeof response.json === "function") {
      try {
        const payload = (await response.json()) as { detail?: unknown };
        if (typeof payload.detail === "string") {
          detail = payload.detail;
        }
      } catch {
        // Keep the status-based fallback when an error response has no JSON body.
      }
    }
    throw new ApiError(
      detail ?? `API request failed with status ${response.status}.`,
      response.status
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

const authHeader = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
});

const jsonRequest = (token: string, body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json", ...authHeader(token) },
  body: JSON.stringify(body),
});

// --- Auth --------------------------------------------------------------

export const register = (username: string, password: string) =>
  apiRequest<AuthSession>("auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

export const login = (username: string, password: string) =>
  apiRequest<AuthSession>("auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

export const logout = (token: string) =>
  apiRequest<void>("auth/logout", {
    method: "POST",
    headers: authHeader(token),
  });

// --- Boards --------------------------------------------------------------

export const listBoards = (token: string, signal?: AbortSignal) =>
  apiRequest<{ boards: BoardSummary[] }>("boards", {
    headers: authHeader(token),
    signal,
  });

export const createBoard = (token: string, name: string) =>
  apiRequest<BoardSnapshot>("boards", {
    ...jsonRequest(token, { name }),
    method: "POST",
  });

export const getBoard = (token: string, boardId: string, signal?: AbortSignal) =>
  apiRequest<BoardSnapshot>(`boards/${boardId}`, {
    headers: authHeader(token),
    signal,
  });

export const renameBoard = (token: string, boardId: string, name: string) =>
  apiRequest<BoardSnapshot>(`boards/${boardId}`, {
    ...jsonRequest(token, { name }),
    method: "PATCH",
  });

export const deleteBoard = (token: string, boardId: string) =>
  apiRequest<{ boards: BoardSummary[] }>(`boards/${boardId}`, {
    method: "DELETE",
    headers: authHeader(token),
  });

// --- Columns --------------------------------------------------------------

export const createColumn = (token: string, boardId: string, title: string) =>
  apiRequest<BoardSnapshot>(`boards/${boardId}/columns`, {
    ...jsonRequest(token, { title }),
    method: "POST",
  });

export const renameColumn = (
  token: string,
  boardId: string,
  columnId: string,
  title: string
) =>
  apiRequest<BoardSnapshot>(`boards/${boardId}/columns/${columnId}`, {
    ...jsonRequest(token, { title }),
    method: "PATCH",
  });

export const deleteColumn = (token: string, boardId: string, columnId: string) =>
  apiRequest<BoardSnapshot>(`boards/${boardId}/columns/${columnId}`, {
    method: "DELETE",
    headers: authHeader(token),
  });

// --- Labels --------------------------------------------------------------

export const createLabel = (token: string, boardId: string, name: string, color: LabelColor) =>
  apiRequest<BoardSnapshot>(`boards/${boardId}/labels`, {
    ...jsonRequest(token, { name, color }),
    method: "POST",
  });

export const deleteLabel = (token: string, boardId: string, labelId: string) =>
  apiRequest<BoardSnapshot>(`boards/${boardId}/labels/${labelId}`, {
    method: "DELETE",
    headers: authHeader(token),
  });

export const attachLabel = (token: string, boardId: string, cardId: string, labelId: string) =>
  apiRequest<BoardSnapshot>(`boards/${boardId}/cards/${cardId}/labels/${labelId}`, {
    method: "POST",
    headers: authHeader(token),
  });

export const detachLabel = (token: string, boardId: string, cardId: string, labelId: string) =>
  apiRequest<BoardSnapshot>(`boards/${boardId}/cards/${cardId}/labels/${labelId}`, {
    method: "DELETE",
    headers: authHeader(token),
  });

// --- Cards --------------------------------------------------------------

export const createCard = (
  token: string,
  boardId: string,
  columnId: string,
  title: string,
  details: string,
  priority: Priority,
  dueDate: string | null
) =>
  apiRequest<BoardSnapshot>(`boards/${boardId}/columns/${columnId}/cards`, {
    ...jsonRequest(token, {
      title,
      details,
      priority,
      dueDate: dueDate ?? undefined,
    }),
    method: "POST",
  });

export const updateCard = (
  token: string,
  boardId: string,
  cardId: string,
  patch: CardPatch
) =>
  apiRequest<BoardSnapshot>(`boards/${boardId}/cards/${cardId}`, {
    ...jsonRequest(token, patch),
    method: "PATCH",
  });

export const moveCardRequest = (
  token: string,
  boardId: string,
  cardId: string,
  columnId: string,
  position: number
) =>
  apiRequest<BoardSnapshot>(`boards/${boardId}/cards/${cardId}/move`, {
    ...jsonRequest(token, { columnId, position }),
    method: "POST",
  });

export const deleteCard = (token: string, boardId: string, cardId: string) =>
  apiRequest<BoardSnapshot>(`boards/${boardId}/cards/${cardId}`, {
    method: "DELETE",
    headers: authHeader(token),
  });

// --- AI chat --------------------------------------------------------------

export const chatAboutBoard = (
  token: string,
  boardId: string,
  question: string,
  history: ChatHistoryMessage[]
) =>
  apiRequest<BoardChatResponse>(`boards/${boardId}/chat`, {
    ...jsonRequest(token, { question, history }),
    method: "POST",
  });
