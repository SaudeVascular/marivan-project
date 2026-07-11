// src/hooks/useAnexos.js
import { useState } from 'react';
import { anexosService } from '../services/anexos.service';

export const useAnexos = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const uploadAnexo = async (file, metadata) => {
    try {
      setLoading(true);
      setError(null);
      const anexo = await anexosService.upload(file, metadata);
      return anexo;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const listarAnexos = async (pacienteId, consultaId) => {
    try {
      setLoading(true);
      const anexos = await anexosService.listar(pacienteId, consultaId);
      return anexos;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deletarAnexo = async (id, url) => {
    try {
      setLoading(true);
      await anexosService.deletar(id, url);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    uploadAnexo,
    listarAnexos,
    deletarAnexo,
    loading,
    error
  };
};