// Serviço para gerenciar persistência de dados no localStorage

const STORAGE_KEYS = {
  PACIENTES: 'prontuario_pacientes',
  CONSULTAS: 'prontuario_consultas',
  LAST_BACKUP: 'prontuario_last_backup',
  APP_VERSION: 'prontuario_version'
};

const APP_VERSION = '1.0.0';

class StorageService {
  // Verifica se o localStorage está disponível
  isAvailable() {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Salva dados no localStorage
  save(key, data) {
    try {
      if (!this.isAvailable()) {
        console.warn('localStorage não está disponível');
        return false;
      }

      const dataToSave = {
        data: data,
        timestamp: new Date().toISOString(),
        version: APP_VERSION
      };

      localStorage.setItem(key, JSON.stringify(dataToSave));
      console.log(`✅ Dados salvos em ${key}`);
      return true;
    } catch (error) {
      console.error('Erro ao salvar dados:', error);
      return false;
    }
  }

  // Carrega dados do localStorage
  load(key) {
    try {
      if (!this.isAvailable()) {
        console.warn('localStorage não está disponível');
        return null;
      }

      const savedData = localStorage.getItem(key);
      if (!savedData) return null;

      const parsed = JSON.parse(savedData);
      console.log(`✅ Dados carregados de ${key}`);
      return parsed.data;
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      return null;
    }
  }

  // Remove dados do localStorage
  remove(key) {
    try {
      localStorage.removeItem(key);
      console.log(`🗑️ Dados removidos de ${key}`);
      return true;
    } catch (error) {
      console.error('Erro ao remover dados:', error);
      return false;
    }
  }

  // Limpa todos os dados do prontuário
  clearAll() {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      console.log('🗑️ Todos os dados foram limpos');
      return true;
    } catch (error) {
      console.error('Erro ao limpar dados:', error);
      return false;
    }
  }

  // Salva pacientes
  savePacientes(pacientes) {
    return this.save(STORAGE_KEYS.PACIENTES, pacientes);
  }

  // Carrega pacientes
  loadPacientes() {
    return this.load(STORAGE_KEYS.PACIENTES) || [];
  }

  // Salva consultas
  saveConsultas(consultas) {
    return this.save(STORAGE_KEYS.CONSULTAS, consultas);
  }

  // Carrega consultas
  loadConsultas() {
    return this.load(STORAGE_KEYS.CONSULTAS) || [];
  }

  // Faz backup de todos os dados
  exportBackup() {
    try {
      const backup = {
        pacientes: this.loadPacientes(),
        consultas: this.loadConsultas(),
        exportDate: new Date().toISOString(),
        version: APP_VERSION
      };

      const dataStr = JSON.stringify(backup, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `prontuario_backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
      console.log('✅ Backup exportado com sucesso');
      return true;
    } catch (error) {
      console.error('Erro ao exportar backup:', error);
      return false;
    }
  }

  // Importa backup
  async importBackup(file) {
    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup.pacientes || !backup.consultas) {
        throw new Error('Arquivo de backup inválido');
      }

      // Salva os dados importados
      this.savePacientes(backup.pacientes);
      this.saveConsultas(backup.consultas);

      console.log('✅ Backup importado com sucesso');
      return { success: true, data: backup };
    } catch (error) {
      console.error('Erro ao importar backup:', error);
      return { success: false, error: error.message };
    }
  }

  // Retorna informações sobre o armazenamento
  getStorageInfo() {
    if (!this.isAvailable()) {
      return { available: false };
    }

    let totalSize = 0;
    const items = {};

    Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
      const item = localStorage.getItem(key);
      if (item) {
        const size = new Blob([item]).size;
        totalSize += size;
        items[name] = {
          size: size,
          sizeFormatted: this.formatBytes(size)
        };
      }
    });

    return {
      available: true,
      totalSize: totalSize,
      totalSizeFormatted: this.formatBytes(totalSize),
      items: items,
      lastBackup: this.load(STORAGE_KEYS.LAST_BACKUP)
    };
  }

  // Formata bytes para KB, MB, etc
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Exporta uma instância única do serviço
export default new StorageService();