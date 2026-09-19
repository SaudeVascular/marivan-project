import { useEffect, useRef, useState } from 'react';
import storageService from '../services/storageService';

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

// Hook para gerenciar persistência de dados
export const useDataPersistence = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, saving, saved, error

  // Carrega dados iniciais
  const loadInitialData = () => {
    setIsLoading(true);
    try {
      const pacientes = storageService.loadPacientes();
      const consultas = storageService.loadConsultas();
      
      setIsLoading(false);
      return { pacientes, consultas };
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setIsLoading(false);
      return { pacientes: [], consultas: [] };
    }
  };

  // Salva pacientes com feedback
  const savePacientes = (pacientes) => {
    setSyncStatus('saving');
    const success = storageService.savePacientes(pacientes);
    setSyncStatus(success ? 'saved' : 'error');
    
    // Reset status após 2 segundos
    setTimeout(() => setSyncStatus('idle'), 2000);
    return success;
  };

  // Salva consultas com feedback
  const saveConsultas = (consultas) => {
    setSyncStatus('saving');
    const success = storageService.saveConsultas(consultas);
    setSyncStatus(success ? 'saved' : 'error');
    
    // Reset status após 2 segundos
    setTimeout(() => setSyncStatus('idle'), 2000);
    return success;
  };

  return {
    isLoading,
    syncStatus,
    loadInitialData,
    savePacientes,
    saveConsultas,
    exportBackup: storageService.exportBackup.bind(storageService),
    importBackup: storageService.importBackup.bind(storageService),
    getStorageInfo: storageService.getStorageInfo.bind(storageService)
  };
};
