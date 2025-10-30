export type PreviewErrorCode =
  | "invalid_preview_request"
  | "workspace_not_found"
  | "workspace_not_trained"
  | "runtime_request_failed";

export class PreviewError extends Error {
  code: PreviewErrorCode;
  status: number;

  constructor(message: string, code: PreviewErrorCode, status = 400) {
    super(message);
    this.name = "PreviewError";
    this.code = code;
    this.status = status;
  }
}
