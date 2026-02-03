export interface RequestState {
  abortController: AbortController;
  sessionId?: string;
  workingDirectory?: string;
  kill?: () => void;
}
