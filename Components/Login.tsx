
import React, { useState } from 'react';
import { Cog6ToothIcon, ScaleIcon, SignalIcon, SignalSlashIcon, ExclamationTriangleIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { LoginProps, UserRole, User } from '../types';
import InstallPrompt from './InstallPrompt';
import { supabase } from '../supabaseClient';

const Login: React.FC<LoginProps> = ({ onLogin, onOpenSettings, isCloudConfigured }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!supabase) {
      setError('Erro de configuração do banco de dados.');
      setLoading(false);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (authError) {
        setError(authError.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : authError.message);
      } else if (data.user) {
        const userData: User = {
          firstName: data.user.user_metadata.firstName || data.user.email?.split('@')[0] || 'Usuário',
          lastName: data.user.user_metadata.lastName || '',
          role: data.user.user_metadata.role || UserRole.ADVOGADO,
          email: data.user.email
        };
        onLogin(userData);
      }
    } catch (err: any) {
      console.error('Erro de login:', err);
      if (err.message?.includes('quota') || err.name === 'QuotaExceededError') {
        setError('O armazenamento do seu navegador está cheio. Isso impede o login.');
      } else {
        setError(`Erro de conexão: ${err.message || 'Verifique sua internet ou se o Supabase está ativo.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClearStorage = () => {
    if (confirm('Isso irá limpar os dados temporários do navegador para liberar espaço. Seus dados na nuvem (Supabase) NÃO serão afetados. Deseja continuar?')) {
      // Limpar chaves pesadas conhecidas
      const keysToRemove = ['inss_records', 'inss_contracts', 'inss_user'];
      keysToRemove.forEach(k => localStorage.removeItem(k));
      
      // Limpar backups antigos (se houver)
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('inss_backup_') || key.startsWith('sb-'))) {
           // Não removemos o config do banco para não perder a conexão
           if (key !== 'inss_db_config') {
             localStorage.removeItem(key);
           }
        }
      }
      alert('Espaço liberado! Tente logar novamente.');
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bordeaux-950 via-bordeaux-900 to-bordeaux-950 px-4 py-8 relative overflow-hidden safe-top safe-bottom">
      {/* Padrão decorativo dourado */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{backgroundImage: 'radial-gradient(circle at 20% 30%, #C9A961 0%, transparent 30%), radial-gradient(circle at 80% 70%, #C9A961 0%, transparent 30%)'}}></div>
      {/* Faixas douradas decorativas */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gold-500 to-transparent opacity-60"></div>
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gold-500 to-transparent opacity-60"></div>

      <InstallPrompt />

      <div className="max-w-md w-full bg-bordeaux-950/40 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/60 p-6 sm:p-8 border border-gold-500/20 relative z-10">
        <button onClick={onOpenSettings} className="absolute top-4 right-4 text-cream-100/50 hover:text-gold-300 transition p-2 rounded-full hover:bg-bordeaux-800/60 group" title="Configurar Banco de Dados">
            <Cog6ToothIcon className={`h-5 w-5 ${isCloudConfigured ? 'text-gold-400' : ''}`} />
        </button>

        <div className="text-center mb-8">
          <div className="bg-gradient-to-br from-gold-400 to-gold-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-gold-900/40 ring-2 ring-gold-300/30 transform rotate-3 hover:rotate-6 transition-transform duration-300">
            <ScaleIcon className="h-10 w-10 text-bordeaux-900" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-serif font-semibold text-cream-50 tracking-tight">Felix &amp; Castro</h2>
          <div className="flex items-center justify-center gap-2 mt-1.5">
            <span className="h-px w-6 sm:w-8 bg-gold-500/50"></span>
            <p className="text-gold-300/90 font-serif text-[11px] sm:text-sm tracking-[0.2em] uppercase">Advocacia Especializada</p>
            <span className="h-px w-6 sm:w-8 bg-gold-500/50"></span>
          </div>
          {!isCloudConfigured && (
              <span className="inline-flex items-center gap-1.5 mt-4 px-3 py-1 rounded-full text-[10px] font-bold bg-bordeaux-800/60 text-cream-100/70 border border-gold-500/20">
                  <SignalSlashIcon className="h-3 w-3" />
                  MODO LOCAL (OFFLINE)
              </span>
          )}
          {isCloudConfigured && (
              <span className="inline-flex items-center gap-1.5 mt-4 px-3 py-1 rounded-full text-[10px] font-bold bg-gold-500/10 text-gold-300 border border-gold-500/30 shadow-[0_0_15px_rgba(201,169,97,0.15)]">
                  <SignalIcon className="h-3 w-3" />
                  NUVEM CONECTADA
              </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-4">
            <div>
                <label className="block text-xs font-semibold text-gold-300/80 uppercase tracking-wider mb-1.5 ml-1">E-mail</label>
                <input
                type="email"
                required
                className="w-full px-4 sm:px-5 py-3 bg-bordeaux-950/60 border border-gold-500/20 rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-transparent outline-none transition text-cream-50 placeholder-cream-100/30"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                />
            </div>
            <div>
                <label className="block text-xs font-semibold text-gold-300/80 uppercase tracking-wider mb-1.5 ml-1">Senha</label>
                <input
                type="password"
                required
                className="w-full px-4 sm:px-5 py-3 bg-bordeaux-950/60 border border-gold-500/20 rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-transparent outline-none transition text-cream-50 placeholder-cream-100/30"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                />
            </div>
          </div>

          {error && (
            <div className="space-y-3">
              <div className="p-4 bg-red-900/30 text-red-200 text-sm rounded-xl border border-red-500/30 flex items-center gap-3 animate-pulse">
                <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
                {error}
              </div>
              {error.includes('armazenamento') && (
                <button
                  type="button"
                  onClick={handleClearStorage}
                  className="w-full py-2 text-xs font-bold text-gold-300 hover:text-gold-200 underline transition"
                >
                  Limpar Espaço do Navegador
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-bordeaux-950 font-bold py-3.5 rounded-xl transition duration-300 shadow-lg shadow-gold-900/40 flex items-center justify-center gap-2 group disabled:opacity-50 ring-1 ring-gold-300/40"
          >
            <LockClosedIcon className="h-5 w-5 group-hover:scale-110 transition-transform" />
            {loading ? 'Acessando...' : 'Acessar Sistema'}
          </button>
        </form>

        <div className="mt-8 text-center text-[10px] uppercase tracking-[0.25em] text-cream-100/40 font-serif">
            &copy; 2025 Felix &amp; Castro
        </div>
      </div>
    </div>
  );
};

export default Login;
