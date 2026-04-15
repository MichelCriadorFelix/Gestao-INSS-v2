import React, { useState, useEffect } from 'react';
import { User, UserRole, AUTHORIZED_USERS } from './types';
import { INITIAL_DATA, INITIAL_CONTRACTS_LIST } from './data';
import Login from './Components/Login';
import Dashboard from './Components/Dashboard'; 
import SettingsModal from './Components/SettingsModal';
import { getDbConfig, supabase } from './supabaseClient';
import { safeSetLocalStorage } from './utils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCloudConfigured, setIsCloudConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isDark = localStorage.getItem('inss_theme') === 'dark';
    setDarkMode(isDark);
    if (isDark) { document.documentElement.classList.add('dark'); }
    
    // Inicializar sessão do Supabase
    const initAuth = async () => {
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
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
            await supabase.auth.signOut();
            setUser(null);
            alert("Acesso não autorizado para este e-mail.");
          }
        }

        // Ouvir mudanças na autenticação
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
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
              await supabase.auth.signOut();
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

  return (
    <>
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
