import React, { useState, useEffect } from 'react';
// Commit triggering change (false positive)
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
      
      // Se já estiver configurado e for uma configuração válida, não faz nada
      if (config && config.url && config.key && config.url.includes('supabase.co')) {
        setLoading(false);
        return;
      }

      // Verifica se já tentamos configurar nesta sessão para evitar loop infinito
      const hasAttempted = sessionStorage.getItem('inss_config_attempted');
      if (hasAttempted) {
        setLoading(false);
        return;
      }

      try {
        const configToken = (import.meta as any).env?.VITE_CONFIG_TOKEN || '';
        const response = await fetch('/api/config', {
          headers: configToken ? { 'X-Config-Token': configToken } : {}
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        if (data.url && data.key) {
          console.log("Configuração da nuvem recebida com sucesso.");
          safeSetLocalStorage(DB_CONFIG_KEY, JSON.stringify({
            url: data.url,
            key: data.key,
            isEnv: true
          }));
          sessionStorage.setItem('inss_config_attempted', 'true');
          // Pequeno delay antes de recarregar para garantir o salvamento
          setTimeout(() => window.location.reload(), 300);
        } else {
          console.warn("Configuração da nuvem retornou dados vazios do servidor.");
          setLoading(false);
        }
      } catch (error) {
        console.error("Falha na auto-configuração da nuvem:", error);
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-bordeaux-950 via-bordeaux-900 to-bordeaux-950 text-cream-50 relative overflow-hidden">
        {/* Decoração dourada */}
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{backgroundImage: 'radial-gradient(circle at 30% 40%, #C9A961 0%, transparent 40%), radial-gradient(circle at 70% 60%, #C9A961 0%, transparent 40%)'}}></div>
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gold-500 to-transparent opacity-70"></div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gold-500 to-transparent opacity-70"></div>
        
        {/* Logo F&C */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="bg-gradient-to-br from-gold-400 to-gold-600 w-24 h-24 rounded-2xl flex items-center justify-center mb-6 shadow-2xl shadow-gold-900/50 ring-2 ring-gold-300/40 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-12 w-12 text-bordeaux-950">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
            </svg>
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-serif font-semibold text-cream-50 tracking-tight">Felix &amp; Castro</h1>
          <div className="flex items-center justify-center gap-3 mt-2 mb-8">
            <span className="h-px w-8 bg-gold-500/60"></span>
            <p className="text-gold-300/90 font-serif text-xs tracking-[0.25em] uppercase">Advocacia Especializada</p>
            <span className="h-px w-8 bg-gold-500/60"></span>
          </div>
          
          {/* Spinner dourado */}
          <div className="relative">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-gold-500/20 border-t-gold-500"></div>
          </div>
          <p className="text-cream-100/60 text-xs uppercase tracking-[0.2em] mt-4 font-serif">Iniciando sistema jurídico</p>
        </div>
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
