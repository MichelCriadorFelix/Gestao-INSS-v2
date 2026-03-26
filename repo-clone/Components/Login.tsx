
import React, { useState } from 'react';
import { Cog6ToothIcon, ScaleIcon, SignalIcon, SignalSlashIcon, ExclamationTriangleIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { LoginProps, AUTHORIZED_USERS } from '../types';
import InstallPrompt from './InstallPrompt';

const Login: React.FC<LoginProps> = ({ onLogin, onOpenSettings, isCloudConfigured }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const foundUser = AUTHORIZED_USERS.find(
      u => u.firstName.toLowerCase() === firstName.trim().toLowerCase() && 
           u.lastName.toLowerCase() === lastName.trim().toLowerCase()
    );

    if (foundUser) {
      onLogin(foundUser);
    } else {
      setError('Acesso negado. Credenciais inválidas.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
      
      <InstallPrompt />
      
      <div className="max-w-md w-full bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/10 relative z-10">
        <button onClick={onOpenSettings} className="absolute top-4 right-4 text-slate-400 hover:text-white transition p-2 rounded-full hover:bg-white/10 group" title="Configurar Banco de Dados">
            <Cog6ToothIcon className={`h-5 w-5 ${isCloudConfigured ? 'text-green-400' : 'text-slate-400 group-hover:text-white'}`} />
        </button>

        <div className="text-center mb-8">
          <div className="bg-gradient-to-tr from-primary-600 to-primary-400 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary-500/30 transform rotate-3 hover:rotate-6 transition-transform duration-300">
            <ScaleIcon className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Gestão do Escritório</h2>
          <p className="text-slate-300 mt-2 font-medium">Acesso Exclusivo Jurídico</p>
          {!isCloudConfigured && (
              <span className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700/50">
                  <SignalSlashIcon className="h-3 w-3" />
                  MODO LOCAL (OFFLINE)
              </span>
          )}
          {isCloudConfigured && (
              <span className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-[10px] font-bold bg-green-900/40 text-green-400 border border-green-800/50 shadow-[0_0_10px_rgba(74,222,128,0.2)]">
                  <SignalIcon className="h-3 w-3" />
                  NUVEM CONECTADA
              </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-4">
            <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 ml-1">Nome</label>
                <input
                type="text"
                required
                className="w-full px-5 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition text-white placeholder-slate-500"
                placeholder="Ex: Michel"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                />
            </div>
            <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 ml-1">Sobrenome</label>
                <input
                type="text"
                required
                className="w-full px-5 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition text-white placeholder-slate-500"
                placeholder="Ex: Felix"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 text-red-200 text-sm rounded-xl border border-red-500/20 flex items-center gap-3 animate-pulse">
              <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-bold py-3.5 rounded-xl transition duration-300 shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2 group"
          >
            <LockClosedIcon className="h-5 w-5 group-hover:scale-110 transition-transform" />
            Acessar Sistema
          </button>
        </form>
        
        <div className="mt-8 text-center text-xs text-slate-500">
            &copy; 2025 Felix e Castro Advocacia Especializada
        </div>
      </div>
    </div>
  );
};

export default Login;
