import { useState, useEffect, useCallback } from 'react';

// Simple React Query-like hook for API calls
export const useApi = (apiCall, dependencies = [], options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { 
    enabled = true, 
    onSuccess, 
    onError,
    initialData = null 
  } = options;

  const execute = useCallback(async (params) => {
    if (!enabled) return;

    try {
      setLoading(true);
      setError(null);
      
      const result = await (typeof apiCall === 'function' ? apiCall(params) : apiCall);
      
      setData(result);
      if (onSuccess) onSuccess(result);
      return result;
    } catch (err) {
      setError(err);
      if (onError) onError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiCall, enabled, onSuccess, onError]);

  useEffect(() => {
    if (enabled && apiCall) {
      execute();
    } else {
      setLoading(false);
      if (initialData !== null) {
        setData(initialData);
      }
    }
  }, [execute, enabled, initialData, ...dependencies]);

  const refetch = useCallback(() => execute(), [execute]);

  return {
    data,
    loading,
    error,
    refetch,
    execute,
  };
};

// Hook for mutations (POST, PUT, DELETE)
export const useMutation = (mutationFn, options = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { onSuccess, onError } = options;

  const mutate = useCallback(async (data) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await mutationFn(data);
      
      if (onSuccess) onSuccess(result);
      return result;
    } catch (err) {
      setError(err);
      if (onError) onError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [mutationFn, onSuccess, onError]);

  return {
    mutate,
    loading,
    error,
  };
};

// Convenience hooks for common API patterns
export const useQuery = (queryFn, dependencies, options) => {
  return useApi(queryFn, dependencies, options);
};

export const useInvalidation = () => {
  const [invalidationKeys, setInvalidationKeys] = useState(new Set());

  const invalidate = useCallback((key) => {
    setInvalidationKeys(prev => new Set([...prev, key]));
  }, []);

  const clearInvalidation = useCallback((key) => {
    setInvalidationKeys(prev => {
      const newSet = new Set(prev);
      newSet.delete(key);
      return newSet;
    });
  }, []);

  return {
    invalidationKeys,
    invalidate,
    clearInvalidation,
  };
};

// Local storage cache for API responses
const cache = new Map();

export const useCachedApi = (key, apiCall, dependencies = [], options = {}) => {
  const { cacheTime = 300000 } = options; // 5 minutes default

  const getCachedData = useCallback(() => {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < cacheTime) {
      return cached.data;
    }
    return null;
  }, [key, cacheTime]);

  const setCachedData = useCallback((data) => {
    cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }, [key]);

  const cachedData = getCachedData();
  
  return useApi(
    async (params) => {
      const result = await apiCall(params);
      setCachedData(result);
      return result;
    },
    dependencies,
    {
      ...options,
      initialData: cachedData,
    }
  );
};