export type ApiEnvelope<T> = {
  code: string;
  message: string;
  data: T;
};

export class ApiError extends Error {
  code: string;
  status?: number;
  data?: unknown;

  constructor(message: string, code: string, status?: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.data = data;
  }
}
