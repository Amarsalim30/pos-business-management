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
  const isFetchingMoreRef = useRef<boolean>(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const fetchFnRef = useRef(fetchFn);
  const activeRequestIdRef = useRef<number>(0);

  // Keep fetchFn reference synchronously fresh
  fetchFnRef.current = fetchFn;

  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  const loadingMoreRef = useRef(loadingMore);
  loadingMoreRef.current = loadingMore;

  const loadInitial = useCallback(async () => {
    const currentRequestId = ++activeRequestIdRef.current;
    setLoading(true);
    setError(null);
    offsetRef.current = 0;

    try {
      const newItems = await fetchFnRef.current(0, limit);
      // Discard if a newer request was dispatched
      if (currentRequestId !== activeRequestIdRef.current) return;

      setItems(newItems);
      const moreAvailable = newItems.length >= limit && newItems.length > 0;
      setHasMore(moreAvailable);
      hasMoreRef.current = moreAvailable;
      offsetRef.current = newItems.length;
    } catch (err: any) {
      if (currentRequestId !== activeRequestIdRef.current) return;
      console.error('Failed to load initial batch:', err);
      setError(err?.message || 'Failed to load items');
    } finally {
      if (currentRequestId === activeRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [limit]);

  const loadMore = useCallback(async () => {
    if (isFetchingMoreRef.current || loadingRef.current || !hasMoreRef.current) return;
    isFetchingMoreRef.current = true;
    setLoadingMore(true);
    const currentRequestId = activeRequestIdRef.current;

    try {
      const currentOffset = offsetRef.current;
      const newItems = await fetchFnRef.current(currentOffset, limit);
      if (currentRequestId !== activeRequestIdRef.current) return;

      setItems((prev) => [...prev, ...newItems]);
      const moreAvailable = newItems.length >= limit && newItems.length > 0;
      setHasMore(moreAvailable);
      hasMoreRef.current = moreAvailable;
      offsetRef.current = currentOffset + newItems.length;
    } catch (err: any) {
      if (currentRequestId !== activeRequestIdRef.current) return;
      console.error('Failed to load more items:', err);
      setError(err?.message || 'Failed to load more items');
    } finally {
      if (currentRequestId === activeRequestIdRef.current) {
        setLoadingMore(false);
      }
      isFetchingMoreRef.current = false;
    }
  }, [limit]);

  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  // Reset and load first page on dependency changes
  useEffect(() => {
    loadInitial();
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
          !loadingMoreRef.current
        ) {
          loadMoreRef.current();
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
    await loadInitial();
  }, [loadInitial]);

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

