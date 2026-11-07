import { useEffect, useRef, useState } from "react";
import type { PageSourceRef } from "@/types/document";
import { renderPageSource } from "@/services/pdfRenderer";

interface State {
  src: string | null;
  loading: boolean;
  error: string | null;
}

export function usePdfPageImage(
  source: PageSourceRef | undefined,
  width: number,
  enabled = true,
): State {
  const [state, setState] = useState<State>({
    src: null,
    loading: Boolean(source) && enabled,
    error: null,
  });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!source || !enabled) {
      setState((current) => ({
        src: current.src,
        loading: false,
        error: current.error,
      }));
      return;
    }
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));
    renderPageSource(source, width)
      .then((src) => {
        if (!cancelled && mounted.current) setState({ src, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled && mounted.current) {
          setState({
            src: null,
            loading: false,
            error: error instanceof Error ? error.message : "Page preview failed.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source?.assetId, source?.pageIndex, source?.rotationOffset, width, enabled]);

  return state;
}

export function useInViewport<T extends HTMLElement>(
  rootMargin = "300px",
): { ref: React.RefObject<T>; inView: boolean } {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, inView };
}

export function useElementWidth<T extends HTMLElement>(
  fallback = 0,
): { ref: React.RefObject<T>; width: number } {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWidth(element.getBoundingClientRect().width);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [fallback]);

  return { ref, width };
}
