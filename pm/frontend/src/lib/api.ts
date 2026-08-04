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
};

export type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type BoardChatResponse = BoardSnapshot & {
  assistant: string;
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

  return (await response.json()) as T;
};

const authenticatedRequest = (username: string, body?: unknown): RequestInit => ({
  headers: {
    "Content-Type": "application/json",
    "X-Username": username,
  },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const getBoard = (username: string, signal?: AbortSignal) =>
  apiRequest<BoardSnapshot>(`users/${username}/board`, {
    headers: { "X-Username": username },
    signal,
  });

export const renameColumn = (username: string, columnId: string, title: string) =>
  apiRequest<BoardSnapshot>(
    `users/${username}/board/columns/${columnId}`,
    {
      ...authenticatedRequest(username, { title }),
      method: "PATCH",
    }
  );

export const createCard = (
  username: string,
  columnId: string,
  title: string,
  details: string
) =>
  apiRequest<BoardSnapshot>(`users/${username}/board/cards`, {
    ...authenticatedRequest(username, { columnId, title, details }),
    method: "POST",
  });

export const updateCard = (
  username: string,
  cardId: string,
  title: string,
  details: string
) =>
  apiRequest<BoardSnapshot>(`users/${username}/board/cards/${cardId}`, {
    ...authenticatedRequest(username, { title, details }),
    method: "PATCH",
  });

export const moveCardRequest = (
  username: string,
  cardId: string,
  columnId: string,
  position: number
) =>
  apiRequest<BoardSnapshot>(
    `users/${username}/board/cards/${cardId}/move`,
    {
      ...authenticatedRequest(username, { columnId, position }),
      method: "POST",
    }
  );

export const deleteCard = (username: string, cardId: string) =>
  apiRequest<BoardSnapshot>(`users/${username}/board/cards/${cardId}`, {
    ...authenticatedRequest(username),
    method: "DELETE",
  });

export const chatAboutBoard = (
  username: string,
  question: string,
  history: ChatHistoryMessage[]
) =>
  apiRequest<BoardChatResponse>(`users/${username}/board/chat`, {
    ...authenticatedRequest(username, { question, history }),
    method: "POST",
  });
