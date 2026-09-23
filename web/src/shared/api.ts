export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function errorMessage(detail: unknown, status: number): string {
  if (typeof detail === "string" && detail.trim()) return detail;

  if (Array.isArray(detail)) {
    const issues = detail.flatMap((item: unknown) => {
      if (typeof item !== "object" || item === null) return [];

      const { loc, msg } = item as { loc?: unknown; msg?: unknown };
      if (typeof msg !== "string" || !msg.trim()) return [];

      const field = Array.isArray(loc)
        ? loc.slice(1).filter((part): part is string | number =>
            typeof part === "string" || typeof part === "number",
          ).join(".")
        : "";
      const message = msg === "Field required" ? "обязательное поле" : msg;
      return [field ? `${field}: ${message}` : message];
    });

    if (issues.length > 0) return `Проверьте данные: ${issues.join("; ")}`;
  }

  return `Ошибка запроса (${status}). Повторите попытку.`;
}

export async function request<T>(
  path: `/api/${string}`,
  options: RequestOptions = {},
): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? "GET",
      credentials: "same-origin",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError("Не удалось связаться с сервером. Проверьте подключение и повторите попытку.", 0);
  }

  if (!response.ok) {
    if (response.status === 401 && path !== "/api/auth/login" && path !== "/api/auth/me") {
      window.dispatchEvent(new Event("aisana-auth-expired"));
    }
    let detail: unknown;
    try {
      const payload: unknown = await response.json();
      if (typeof payload === "object" && payload !== null && "detail" in payload) {
        detail = payload.detail;
      }
    } catch {
      // Сервер мог вернуть ответ без JSON тела.
    }
    throw new ApiError(errorMessage(detail, response.status), response.status);
  }

  if (response.status === 204) return undefined as T;
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError("Сервер вернул некорректный ответ. Повторите попытку.", response.status);
  }
}
