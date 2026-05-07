type ErrorPayload = {
  error?: string;
};

export type ClientFetchSuccess<T> = {
  ok: true;
  status: number;
  data: T;
};

export type ClientFetchFailure<T> = {
  ok: false;
  status: number;
  error: string;
  data: T | null;
  aborted?: boolean;
};

export type ClientFetchResult<T> = ClientFetchSuccess<T> | ClientFetchFailure<T>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extractErrorMessage(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  return typeof payload.error === "string" && payload.error.trim() ? payload.error : null;
}

function buildHttpError(status: number): string {
  if (status >= 500) return "Errore interno del server";
  if (status === 404) return "Risorsa non trovata";
  if (status === 401) return "Non autorizzato";
  return "Richiesta non riuscita";
}

export async function clientFetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<ClientFetchResult<T>> {
  try {
    const response = await fetch(input, init);
    const text = await response.text();

    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        if (response.ok) {
          return {
            ok: false,
            status: response.status,
            error: "Risposta server non valida",
            data: null,
          };
        }
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: extractErrorMessage(payload) ?? buildHttpError(response.status),
        data: (payload as T | null) ?? null,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: (payload as T | null) ?? ({} as T),
    };
  } catch (error) {
    if ((error as { name?: string } | null)?.name === "AbortError") {
      return {
        ok: false,
        status: 0,
        error: "Richiesta annullata",
        data: null,
        aborted: true,
      };
    }

    return {
      ok: false,
      status: 0,
      error: "Errore di rete",
      data: null,
    };
  }
}

export type ClientErrorResponse = ErrorPayload;
