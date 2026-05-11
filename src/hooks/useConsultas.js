// src/hooks/useConsultas.js
import { useState, useEffect } from 'react';
import { consultasService } from '../services/consultas.service';

export const useConsultas = (filtros = {}) => {
  const [consultas, setConsultas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    carregarConsultas();
  }, [filtros.data, filtros.pacienteId, filtros.medicoId, filtros.status]);

  const carregarConsultas = async () => {
    try {
      setLoading(true);
      const data = await consultasService.listar(filtros);
      setConsultas(data);
    } catch (err) {
      setError(err.message);
      console.error('Erro ao carregar consultas:', err);
    } finally {
      setLoading(false);
    }
  };

  const criarConsulta = async (consultaData) => {
    try {
      const novaConsulta = await consultasService.criar(consultaData);
      await carregarConsultas(); // Recarregar para pegar joins
      return novaConsulta;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const atualizarConsulta = async (id, consultaData) => {
    try {
      const consultaAtualizada = await consultasService.atualizar(id, consultaData);
      await carregarConsultas(); // Recarregar para pegar joins
      return consultaAtualizada;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const realizarConsulta = async (id, dadosClinicos) => {
    try {
      const consultaRealizada = await consultasService.realizar(id, dadosClinicos);
      await carregarConsultas();
      return consultaRealizada;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const cancelarConsulta = async (id) => {
    try {
      await consultasService.cancelar(id);
      await carregarConsultas();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return {
    consultas,
    loading,
    error,
    criarConsulta,
    atualizarConsulta,
    realizarConsulta,
    cancelarConsulta,
    recarregar: carregarConsultas
  };
};