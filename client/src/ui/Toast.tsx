import { useEffect, useState } from 'react';
import { useStore } from '../store';

export function Toast() {
  const toast = useStore((s) => s.toast);
  const [shown, setShown] = useState(toast);
  useEffect(() => {
    if (!toast) return;
    setShown(toast);
    const t = setTimeout(() => setShown(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  if (!shown) return null;
  return <div className={`ui toast-msg ${shown.kind}`} role="status">{shown.text}</div>;
}
