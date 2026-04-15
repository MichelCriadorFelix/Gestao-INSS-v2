import React, { useState, useEffect } from 'react';
import { User, UserRole, AUTHORIZED_USERS } from './types';
import { INITIAL_DATA, INITIAL_CONTRACTS_LIST } from './data';
import Login from './Components/Login';
import Dashboard from './Components/Dashboard'; 
import SettingsModal from './Components/SettingsModal';
import { getDbConfig, supabase, DB_CONFIG_KEY } from './supabaseClient';
import { safeSetLocalStorage } from './utils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCloudConfigured, setIsCloudConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    const isDark = localStorage.getItem('inss_theme') === 'dark';
    setDarkMode(isDark);
    if (isDark) { document.documentElement.classList.add('dark'); }
    
    // Auto-configuração da nuvem para novos dispositivos
    const autoConfigCloud = async () => {
      const config = getDbConfig();
      if (!config) {
        // Verifica se já tentamos configurar para evitar loop infinito
        const hasAttempted = sessionStorage.getItem('inss_config_attempted');
        if (hasAttempted) {
          setConfigError("Não foi possível configurar a nuvem automaticamente. Por favor, configure manualmente nas engrenagens.");
          setLoading(false);
          return;
        }

        try {
          const response = await fetch('/api/config');
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const data = await response.json();
          
          if (data.url && data.key) {
            safeSetLocalStorage(DB_CONFIG_KEY, JSON.stringify({
              url: data.url,
              key: data.key,
              isEnv: true
            }));
            sessionStorage.setItem('inss_config_attempted', 'true');
            // Pequeno delay antes de recarregar para garantir o salvamento
            setTimeout(() => window.location.reload(), 500);
          } else {
            console.warn("Configuração da nuvem retornou dados vazios.");
            setLoading(false);
          }
        } catch (error) {
          console.error("Falha na auto-configuração da nuvem:", error);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    autoConfigCloud();
    
    // Inicializar sessão do Supabase
    const initAuth = async () => {
      const supabaseInstance = supabase;
      if (supabaseInstance) {
        const { data: { session } } = await supabaseInstance.auth.getSession();
        if (session?.user) {
          const email = session.user.email?.toLowerCase();
          const authorizedUser = AUTHORIZED_USERS.find(u => u.email.toLowerCase() === email);

          if (authorizedUser) {
            const userData: User = {
              firstName: authorizedUser.firstName,
              lastName: authorizedUser.lastName,
              role: authorizedUser.role,
              email: session.user.email
            };
            setUser(userData);
          } else {
            // Se não estiver na lista, desloga
            await supabaseInstance.auth.signOut();
            setUser(null);
            alert("Acesso não autorizado para este e-mail.");
          }
        }

        // Ouvir mudanças na autenticação
        const { data: { subscription } } = supabaseInstance.auth.onAuthStateChange(async (_event, session) => {
          if (session?.user) {
            const email = session.user.email?.toLowerCase();
            const authorizedUser = AUTHORIZED_USERS.find(u => u.email.toLowerCase() === email);

            if (authorizedUser) {
              const userData: User = {
                firstName: authorizedUser.firstName,
                lastName: authorizedUser.lastName,
                role: authorizedUser.role,
                email: session.user.email
              };
              setUser(userData);
            } else {
              await supabaseInstance.auth.signOut();
              setUser(null);
              alert("Acesso não autorizado para este e-mail.");
            }
          } else {
            setUser(null);
          }
        });

        return () => subscription.unsubscribe();
      }
      setLoading(false);
    };

    initAuth();
  }, []);
  
  const checkCloudStatus = () => {
      const config = getDbConfig();
      setIsCloudConfigured(!!(config && config.url && config.key));
  };

  useEffect(() => { checkCloudStatus(); }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    safeSetLocalStorage('inss_theme', newMode ? 'dark' : 'light');
    if (newMode) { document.documentElement.classList.add('dark'); } else { document.documentElement.classList.remove('dark'); }
  };

  const handleLogin = (authenticatedUser: User) => { 
      setUser(authenticatedUser); 
  };
  
  const handleLogout = async () => { 
      if (supabase) {
        await supabase.auth.signOut();
      }
      setUser(null); 
  };
  const handleSettingsSave = () => { checkCloudStatus(); };
  
  const handleRestoreBackup = () => {
        const supabaseInstance = supabase;
        if(supabaseInstance) {
             const restore = async () => {
                 await supabaseInstance.from('clients').upsert({ id: 1, data: INITIAL_DATA });
                 await supabaseInstance.from('clients').upsert({ id: 2, data: INITIAL_CONTRACTS_LIST });
                 alert("Dados restaurados com sucesso!");
                 window.location.reload();
             };
             restore();
        } else {
            safeSetLocalStorage('inss_records', JSON.stringify(INITIAL_DATA));
            safeSetLocalStorage('inss_contracts', JSON.stringify(INITIAL_CONTRACTS_LIST));
            alert("Dados locais restaurados!");
            window.location.reload();
        }
    };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mb-4"></div>
        <p className="text-slate-400 animate-pulse">Iniciando sistema jurídico...</p>
      </div>
    );
  }

  return (
    <>
      {configError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-6 py-3 rounded-full shadow-lg text-sm font-bold flex items-center gap-2">
          <span>⚠️ {configError}</span>
          <button onClick={() => setConfigError(null)} className="hover:opacity-70">✕</button>
        </div>
      )}
      {user ? (
        <Dashboard 
            user={user} 
            onLogout={handleLogout} 
            darkMode={darkMode} 
            toggleDarkMode={toggleDarkMode} 
            onOpenSettings={() => setIsSettingsOpen(true)} 
            isCloudConfigured={isCloudConfigured} 
            isSettingsOpen={isSettingsOpen} 
            onCloseSettings={() => setIsSettingsOpen(false)} 
            onSettingsSaved={handleSettingsSave} 
            onRestoreBackup={handleRestoreBackup} 
        />
      ) : (
        <>
            <Login 
                onLogin={handleLogin} 
                onOpenSettings={() => setIsSettingsOpen(true)} 
                isCloudConfigured={isCloudConfigured} 
            />
            <SettingsModal 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
                onSave={handleSettingsSave} 
                onRestoreBackup={handleRestoreBackup} 
            />
        </>
      )}
    </>
  );
}
