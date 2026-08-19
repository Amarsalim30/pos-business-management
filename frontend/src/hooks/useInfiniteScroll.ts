import React, { useState, useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollOptions<T> {
  fetchFn: (offset: number, limit: number) => Promise<T[]>;
  limit?: number;
  dependencies?: any[];
  threshold?: number;
}

interface UseInfiniteScrollReturn<T> {
  items: T[];
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  totalLoaded: number;
  sentinelRef: (node: HTMLElement | null) => void;
  reload: () => Promise<void>;
  error: string | null;
}

export function useInfiniteScroll<T>({
  fetchFn,
  limit = 24,
  dependencies = [],
  threshold = 0.1
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollReturn<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const offsetRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const fetchFnRef = useRef(fetchFn);

  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  const loadingMoreRef = useRef(loadingMore);
  loadingMoreRef.current = loadingMore;

  // Keep fetchFn reference fresh
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  const loadBatch = useCallback(async (isInitial = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (isInitial) {
      setLoading(true);
      setError(null);
      offsetRef.current = 0;
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = offsetRef.current;
      const newItems = await fetchFnRef.current(currentOffset, limit);

      if (isInitial) {
        setItems(newItems);
        const moreAvailable = newItems.length >= limit && newItems.length > 0;
        setHasMore(moreAvailable);
        hasMoreRef.current = moreAvailable;
      } else {
        setItems((prev) => [...prev, ...newItems]);
        const moreAvailable = newItems.length >= limit && newItems.length > 0;
        setHasMore(moreAvailable);
        hasMoreRef.current = moreAvailable;
      }

      offsetRef.current = currentOffset + newItems.length;
    } catch (err: any) {
      console.error('Failed to load batch:', err);
      setError(err?.message || 'Failed to load items');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [limit]);

  const loadBatchRef = useRef(loadBatch);
  loadBatchRef.current = loadBatch;

  // Reset and load first page on dependency changes
  useEffect(() => {
    loadBatch(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  // Stable Intersection observer sentinel callback
  const sentinelRef = useCallback((node: HTMLElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (!node) {
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMoreRef.current &&
          !loadingRef.current &&
          !loadingMoreRef.current &&
          !isFetchingRef.current
        ) {
          loadBatchRef.current(false);
        }
      },
      {
        root: null,
        rootMargin: '100px',
        threshold
      }
    );

    observerRef.current.observe(node);
  }, [threshold]);

  const reload = useCallback(async () => {
    await loadBatch(true);
  }, [loadBatch]);

  return {
    items,
    setItems,
    loading,
    loadingMore,
    hasMore,
    totalLoaded: items.length,
    sentinelRef,
    reload,
    error
  };
}

