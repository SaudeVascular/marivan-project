import { useEffect, useRef, useState } from 'react';

// Hook customizado para auto-salvamento
export const useAutoSave = (data, saveFunction, delay = 2000) => {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [error, setError] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    let cancelado = false;
    setLastSaved(null);
    setError(null);
    setIsSaving(false);
    // Limpa o timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Define um novo timeout para salvar
    timeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        const success = await saveFunction(data);
        if (!cancelado && success) setLastSaved(new Date());
      } catch (err) {
        if (!cancelado) setError(err);
      } finally {
        if (!cancelado) setIsSaving(false);
      }
    }, delay);

    // Cleanup
    return () => {
      cancelado = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, saveFunction, delay]);

  return { isSaving, lastSaved, error };
};
