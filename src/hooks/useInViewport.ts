import { useState, useEffect, useRef } from 'react';

interface UseInViewportOptions {
  rootMargin?: string;
  threshold?: number | number[];
}

/**
 * Hook ligero para detectar si un elemento ha entrado en el viewport mediante IntersectionObserver.
 * Una vez entra en el viewport, se mantiene activo (true) para evitar desmontar o re-descargar recursos.
 */
export function useInViewport<T extends HTMLElement = HTMLDivElement>(
  options: UseInViewportOptions = {}
) {
  const { rootMargin = '200px 0px', threshold = 0.01 } = options;
  const targetRef = useRef<T | null>(null);
  const [isInViewport, setIsInViewport] = useState<boolean>(false);

  useEffect(() => {
    const element = targetRef.current;
    if (!element) return;

    // Si ya está marcado como visible, no necesitamos seguir observando
    if (isInViewport) return;

    // Fallback si el navegador no soporta IntersectionObserver
    if (typeof IntersectionObserver === 'undefined') {
      setIsInViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin, threshold, isInViewport]);

  return { targetRef, isInViewport };
}
