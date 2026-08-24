import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate
} from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ClinicaProvider } from './hooks/useClinica';
import { ToastProvider } from './components/common/Toast';
import Login from './components/Login';
import { pacientesService } from './services/pacientes.service';
import {
  ProtectedLayout,
  SomenteAdmin,
  SomenteClinico,
  SomenteMedico,
  SomenteFinanceiro,
  SomenteFinanceiroOuMedico,
  SomenteRecepcao,
  SomenteEnfermagem,
} from './components/guards';
import { PacientesPage } from './pages/pacientes/PacientesPage';
import { ProntuarioPage } from './pages/pacientes/ProntuarioPage';
import { SinaisVitaisPage, EnfermagemPage } from './pages/enfermagem/EnfermagemPages';
import {
  AtestadoPage,
  ReceituarioPage,
  RelatorioPage,
  ImprimirAtendimentoPage,
  LaudoPage,
  PedidoExamesPage,
  DocumentoPage,
} from './pages/documentos/DocumentosPages';
import { AgendaPage } from './pages/agenda/AgendaPages';
import { RecepcaoPage } from './pages/recepcao/RecepcaoPage';
import {
  CatalogoFinanceiroPage,
  FinanceiroPage,
  ImprimirReciboPage,
} from './pages/financeiro/FinanceiroPages';
import {
  PainelAdministrativoPage,
  UsuariosPage,
  AuditoriaPage,
  ConfiguracoesClinicaPage,
  FiliaisPage,
} from './pages/administracao/AdministracaoPages';
import { RedefinirSenhaPage } from './pages/auth/RedefinirSenhaPage';
import { AtivarContaPage } from './pages/auth/AtivarContaPage';
import { MinhaContaPage } from './pages/auth/MinhaContaPage';

function AppContent() {
  const { user } = useAuth();
  const [pacientes, setPacientes] = React.useState([]);
  const [inicializando, setInicializando] = React.useState(true);

  React.useEffect(() => {
    if (!user?.id) return;
    pacientesService.listar()
      .then(data => setPacientes(data))
      .catch(err => console.error('Erro ao carregar pacientes:', err))
      .finally(() => setInicializando(false));
  }, [user?.id]);

  if (inicializando && user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#666', fontSize: '16px' }}>Carregando pacientes...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/ativar-conta" element={<AtivarContaPage />} />
      {/* A sessão de recuperação é criada a partir do token presente no
          link do e-mail. Esta rota não pode usar o guard das páginas comuns:
          ele pode redirecionar antes de o Supabase terminar de consumir o
          token. A chamada updateUser continua protegida pelo próprio Auth. */}
      <Route
        path="/redefinir-senha"
        element={<RedefinirSenhaPage />}
      />
      <Route path="/" element={<Navigate to="/pacientes" replace />} />
      <Route
        path="/minha-conta"
        element={
          <ProtectedLayout>
            <MinhaContaPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/laudos/:id"
        element={
          <ProtectedLayout>
            <SomenteClinico>
              <LaudoPage pacientes={pacientes} setPacientes={setPacientes} />
            </SomenteClinico>
          </ProtectedLayout>
        }
      />
      <Route
        path="/pedido-exames/:id"
        element={
          <ProtectedLayout>
            <SomenteClinico>
              <PedidoExamesPage pacientes={pacientes} setPacientes={setPacientes} />
            </SomenteClinico>
          </ProtectedLayout>
        }
      />
      <Route
        path="/imprimir/:pacienteId/:registroId"
        element={
          <ProtectedLayout>
            <SomenteClinico>
              <ImprimirAtendimentoPage />
            </SomenteClinico>
          </ProtectedLayout>
        }
      />
      <Route
        path="/painel"
        element={
          <ProtectedLayout>
            <SomenteAdmin>
              <PainelAdministrativoPage />
            </SomenteAdmin>
          </ProtectedLayout>
        }
      />
      <Route
        path="/usuarios"
        element={
          <ProtectedLayout>
            <SomenteAdmin>
              <UsuariosPage />
            </SomenteAdmin>
          </ProtectedLayout>
        }
      />
      <Route
        path="/auditoria"
        element={
          <ProtectedLayout>
            <SomenteAdmin>
              <AuditoriaPage />
            </SomenteAdmin>
          </ProtectedLayout>
        }
      />
      <Route
        path="/configuracoes"
        element={
          <ProtectedLayout>
            <SomenteAdmin>
              <ConfiguracoesClinicaPage />
            </SomenteAdmin>
          </ProtectedLayout>
        }
      />
      <Route
        path="/filiais"
        element={
          <ProtectedLayout>
            <SomenteAdmin>
              <FiliaisPage />
            </SomenteAdmin>
          </ProtectedLayout>
        }
      />
      <Route
        path="/pacientes"
        element={
          <ProtectedLayout>
            <PacientesPage pacientes={pacientes} setPacientes={setPacientes} />
          </ProtectedLayout>
        }
      />
      <Route
        path="/agenda"
        element={
          <ProtectedLayout>
            <AgendaPage pacientes={pacientes} />
          </ProtectedLayout>
        }
      />
      <Route
        path="/recepcao"
        element={
          <ProtectedLayout>
            <SomenteRecepcao>
              <RecepcaoPage pacientes={pacientes} />
            </SomenteRecepcao>
          </ProtectedLayout>
        }
      />
      <Route
        path="/enfermagem"
        element={
          <ProtectedLayout>
            <SomenteEnfermagem>
              <EnfermagemPage pacientes={pacientes} />
            </SomenteEnfermagem>
          </ProtectedLayout>
        }
      />
      <Route
        path="/financeiro"
        element={
          <ProtectedLayout>
            <SomenteFinanceiroOuMedico>
              <FinanceiroPage pacientes={pacientes} />
            </SomenteFinanceiroOuMedico>
          </ProtectedLayout>
        }
      />
      <Route
        path="/financeiro/config"
        element={
          <ProtectedLayout>
            <SomenteFinanceiro>
              <CatalogoFinanceiroPage />
            </SomenteFinanceiro>
          </ProtectedLayout>
        }
      />
      <Route
        path="/financeiro/recibo/:id"
        element={
          <ProtectedLayout>
            <SomenteFinanceiro>
              <ImprimirReciboPage />
            </SomenteFinanceiro>
          </ProtectedLayout>
        }
      />
      <Route
        path="/prontuario/:id"
        element={
          <ProtectedLayout>
            <SomenteClinico>
              <ProntuarioPage pacientes={pacientes} setPacientes={setPacientes} />
            </SomenteClinico>
          </ProtectedLayout>
        }
      />
      <Route
        path="/receituario/:id"
        element={
          <ProtectedLayout>
            <SomenteMedico>
              <ReceituarioPage pacientes={pacientes} setPacientes={setPacientes} />
            </SomenteMedico>
          </ProtectedLayout>
        }
      />
      <Route
        path="/prescricao/:id"
        element={
          <ProtectedLayout>
            <SomenteMedico>
              <DocumentoPage titulo="Prescrição Médica" pacientes={pacientes} />
            </SomenteMedico>
          </ProtectedLayout>
        }
      />
      <Route
        path="/atestados/:id"
        element={
          <ProtectedLayout>
            <SomenteMedico>
              <AtestadoPage pacientes={pacientes} setPacientes={setPacientes} />
            </SomenteMedico>
          </ProtectedLayout>
        }
      />
      <Route
        path="/sinais-vitais/:id"
        element={
          <ProtectedLayout>
            <SomenteClinico>
              <SinaisVitaisPage pacientes={pacientes} setPacientes={setPacientes} />
            </SomenteClinico>
          </ProtectedLayout>
        }
      />
      <Route
        path="/relatorios/:id"
        element={
          <ProtectedLayout>
            <SomenteClinico>
              <RelatorioPage pacientes={pacientes} setPacientes={setPacientes} />
            </SomenteClinico>
          </ProtectedLayout>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <ClinicaProvider>
            <AppContent />
          </ClinicaProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
