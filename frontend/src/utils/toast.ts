export type ToastType = "error" | "success" | "info";
export type Toast = { id: number; type: ToastType; message: string };

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
let listeners: Listener[] = [];
let nextId = 1;

function emit() {
  listeners.forEach((l) => l([...toasts]));
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.push(listener);
  listener([...toasts]);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function push(type: ToastType, message: string, durationMs: number) {
  const id = nextId++;
  toasts = [...toasts, { id, type, message }];
  emit();
  setTimeout(() => dismissToast(id), durationMs);
}

export const toast = {
  error: (message: string) => push("error", message, 6000),
  success: (message: string) => push("success", message, 4500),
  info: (message: string) => push("info", message, 4500),
};
