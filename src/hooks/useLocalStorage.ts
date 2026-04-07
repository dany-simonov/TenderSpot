import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error('useLocalStorage setValue error:', error);
    }
  };

  return [storedValue, setValue];
}

export function useLastSync(): [string, () => void] {
  const [lastSync, setLastSync] = useLocalStorage<string>(
    'tenderspot_last_sync',
    new Date().toISOString()
  );

  const refresh = () => {
    const now = new Date().toISOString();
    setLastSync(now);
  };

  return [lastSync, refresh];
}
