import { useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';

const IDLE_TIMEOUT = 20 * 60 * 1000; // 20 minutos

export default function IdleTimer() {
  const { isAuthenticated, logout } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => logout(), IDLE_TIMEOUT);
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      clearTimeout(timer);
    };
  }, [isAuthenticated, logout]);

  return null;
}