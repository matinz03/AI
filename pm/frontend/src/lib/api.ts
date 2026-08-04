export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const apiRequest = async <T>(
  path: string,
  options?: RequestInit
): Promise<T> => {
  const normalizedPath = path.replace(/^\/+/, "");
  const response = await fetch(`/api/${normalizedPath}`, options);

  if (!response.ok) {
    throw new ApiError(
      `API request failed with status ${response.status}.`,
      response.status
    );
  }

  return (await response.json()) as T;
};
