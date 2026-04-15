import React, { useState, useEffect } from 'react';
import { User, UserRole } from './types';
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
          // Mapear usuário do Supabase para o nosso tipo User
          const userData: User = {
            firstName: session.user.user_metadata.firstName || session.user.email?.split('@')[0] || 'Usuário',
            lastName: session.user.user_metadata.lastName || '',
            role: session.user.user_metadata.role || UserRole.ADVOGADO,
            email: session.user.email
          };
          setUser(userData);
        }

        // Ouvir mudanças na autenticação
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user) {
            const userData: User = {
              firstName: session.user.user_metadata.firstName || session.user.email?.split('@')[0] || 'Usuário',
              lastName: session.user.user_metadata.lastName || '',
              role: session.user.user_metadata.role || UserRole.ADVOGADO,
              email: session.user.email
            };
            setUser(userData);
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
