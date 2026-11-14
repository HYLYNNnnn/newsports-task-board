import { useEffect, useRef, type MouseEvent } from "react";

// Delay only the single click so a double click never opens an intermediate view.
export function useTaskClick(onSingle: () => void, onDouble: () => void) {
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const single = useRef(onSingle);
  single.current = onSingle;
  const double = useRef(onDouble);
  double.current = onDouble;
  const clear = () => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = null;
  };
  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current);
    },
    [],
  );
  return {
    cancel: clear,
    onClick: (event: MouseEvent) => {
      clear();
      if (event.detail > 1) return;
      pending.current = setTimeout(() => {
        pending.current = null;
        single.current();
      }, 260);
    },
    onDoubleClick: (event: MouseEvent) => {
      event.preventDefault();
      clear();
      double.current();
    },
  };
}
