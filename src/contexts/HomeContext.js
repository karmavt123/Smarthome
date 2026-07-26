import { createContext, useState, useEffect, useCallback } from 'react';
import homeService from '~/services/homeService';
import useAuth from '~/hooks/useAuth';

const CURRENT_HOME_ID_KEY = 'currentHomeId';

export const HomeContext = createContext(null);

function HomeProvider({ children }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [homes, setHomes] = useState([]);
  const [currentHomeId, setCurrentHomeId] = useState(() => {
    const stored = localStorage.getItem(CURRENT_HOME_ID_KEY);
    return stored ? Number(stored) : null;
  });
  const [isLoadingHomes, setIsLoadingHomes] = useState(true);

  const refreshHomes = useCallback(async () => {
    const data = await homeService.getAll();
    setHomes(data);
    return data;
  }, []);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!isAuthenticated) {
      setHomes([]);
      setCurrentHomeId(null);
      localStorage.removeItem(CURRENT_HOME_ID_KEY);
      setIsLoadingHomes(false);
      return;
    }

    let cancelled = false;
    setIsLoadingHomes(true);
    refreshHomes()
      .then((data) => {
        if (cancelled) return;
        setCurrentHomeId((prevId) => {
          if (prevId && data.some((home) => home.id === prevId)) return prevId;
          localStorage.removeItem(CURRENT_HOME_ID_KEY);
          return null;
        });
      })
      .finally(() => {
        if (!cancelled) setIsLoadingHomes(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isAuthLoading, refreshHomes]);

  const selectHome = useCallback((id) => {
    setCurrentHomeId(id);
    localStorage.setItem(CURRENT_HOME_ID_KEY, String(id));
  }, []);

  const currentHome = homes.find((home) => home.id === currentHomeId) || null;

  return (
    <HomeContext.Provider
      value={{ homes, currentHome, currentHomeId, isLoadingHomes, selectHome, refreshHomes }}
    >
      {children}
    </HomeContext.Provider>
  );
}

export default HomeProvider;
