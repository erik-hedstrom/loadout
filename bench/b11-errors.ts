/** Only harness-authored diagnostics cross the CLI's error boundary. */
export class HarnessError extends Error {}

export function failureMessage(error: unknown): string {
  return error instanceof HarnessError ? error.message : 'B11 stopped: input or provider detail suppressed.';
}
