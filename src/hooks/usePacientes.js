// src/hooks/usePacientes.js
import { useState, useEffect } from 'react';
import { pacientesService } from '../services/pacientes.service';

export const usePacientes = (filtro = '') => {
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    carregarPacientes();
  }, [filtro]);

  const carregarPacientes = async () => {
    try {
      setLoading(true);
      const data = await pacientesService.listar(filtro);
      setPacientes(data);
    } catch (err) {
      setError(err.message);
      console.error('Erro ao carregar pacientes:', err);
    } finally {
      setLoading(false);
    }
  };

  const criarPaciente = async (pacienteData) => {
    try {
      const novoPaciente = await pacientesService.criar(pacienteData);
      setPacientes([...pacientes, novoPaciente]);
      return novoPaciente;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const atualizarPaciente = async (id, pacienteData) => {
    try {
      const pacienteAtualizado = await pacientesService.atualizar(id, pacienteData);
      setPacientes(pacientes.map(p => 
        p.id === id ? pacienteAtualizado : p
      ));
      return pacienteAtualizado;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deletarPaciente = async (id) => {
    try {
      await pacientesService.deletar(id);
      setPacientes(pacientes.filter(p => p.id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return {
    pacientes,
    loading,
    error,
    criarPaciente,
    atualizarPaciente,
    deletarPaciente,
    recarregar: carregarPacientes
  };
};