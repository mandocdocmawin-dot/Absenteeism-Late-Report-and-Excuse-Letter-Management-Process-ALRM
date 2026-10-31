import { useCallback, useEffect, useRef, useState } from "react";

const views = new Map();

export function clearPageViewState() {
  views.clear();
}

export function usePageViewState(key, initialState) {
  const [state, setState] = useState(() => views.get(key)?.state || initialState);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const update = useCallback((value) => {
    setState((current) => {
      const next = typeof value === "function" ? value(current) : value;
      views.set(key, { state: next, scrollY: views.get(key)?.scrollY || 0 });
      return next;
    });
  }, [key]);

  useEffect(() => {
    const saved = views.get(key);
    const frame = requestAnimationFrame(() => saved?.scrollY && window.scrollTo({ top: saved.scrollY }));
    return () => {
      cancelAnimationFrame(frame);
      views.set(key, { state: stateRef.current, scrollY: window.scrollY });
    };
  }, [key]);

  return [state, update];
}
