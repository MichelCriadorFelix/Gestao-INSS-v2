import React, { useState } from 'react';
import { MagnifyingGlassIcon, ScaleIcon, ArrowTopRightOnSquareIcon, ArrowLeftIcon, ArrowPathIcon, PlusIcon } from '@heroicons/react/24/outline';

interface Court {
  id: string;
  title: string;
  description: string;
  link: string;
  searchUrl: string; // URL de busca direta
  category: string;
}

const INITIAL_COURTS: Court[] = [
  {
    id: 'jusbrasil',
    title: 'Jusbrasil',
    description: 'Pesquisa unificada de jurisprudência, doutrina e diários oficiais de todos os tribunais do Brasil.',
    link: 'https://www.jusbrasil.com.br/jurisprudencia/',
    searchUrl: 'https://www.jusbrasil.com.br/jurisprudencia/busca?q={q}',
    category: 'Geral'
  }
];

const Jurisprudence: React.FC = () => {
  const [globalSearch, setGlobalSearch] = useState('');

  const handleQuickSearch = (court: Court) => {
    const query = globalSearch || 'jurisprudencia';
    const finalUrl = court.searchUrl.replace('{q}', encodeURIComponent(query));
    
    const width = 1200;
    const height = 900;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    
    window.open(finalUrl, `search_${court.id}`, `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`);
  };

  const jusbrasil = INITIAL_COURTS[0];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* BUSCADOR PRINCIPAL JUSBRASIL */}
      <div className="bg-gradient-to-br from-indigo-600 to-primary-700 rounded-[2.5rem] p-10 md:p-16 shadow-2xl shadow-indigo-500/20 text-white relative overflow-hidden">
        {/* Elementos decorativos de fundo */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-indigo-400/20 rounded-full blur-3xl"></div>

        <div className="relative z-10 text-center">
          <div className="inline-flex p-4 bg-white/10 backdrop-blur-xl rounded-2xl mb-6 border border-white/20">
            <ScaleIcon className="w-10 h-10 text-indigo-100" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">Pesquisa Jusbrasil</h2>
          <p className="text-indigo-100 text-lg mb-10 max-w-2xl mx-auto opacity-90">
            Acesse a maior base de dados jurídica do país. Pesquise em todos os tribunais simultaneamente com sua conta Pro.
          </p>
          
          <div className="relative max-w-2xl mx-auto group">
            <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-7 w-7 text-indigo-300 group-focus-within:text-white transition-colors" />
            </div>
            <input
              type="text"
              placeholder="O que você deseja pesquisar hoje?"
              className="w-full pl-16 pr-36 py-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl text-xl placeholder:text-indigo-200 focus:outline-none focus:ring-4 focus:ring-white/30 transition-all shadow-2xl"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && globalSearch) handleQuickSearch(jusbrasil);
              }}
            />
            <div className="absolute right-3 inset-y-3">
               <button 
                 onClick={() => handleQuickSearch(jusbrasil)}
                 className="h-full px-8 bg-white text-indigo-600 font-bold text-lg rounded-2xl hover:bg-indigo-50 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
               >
                 Buscar
               </button>
            </div>
          </div>
          
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <span className="text-sm font-medium text-indigo-200 uppercase tracking-widest mr-2 self-center opacity-70">Sugestões:</span>
            {['Aposentadoria Especial', 'Revisão da Vida Toda', 'Dano Moral INSS', 'Auxílio Doença'].map(tag => (
              <button 
                key={tag}
                onClick={() => setGlobalSearch(tag)}
                className="text-sm bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition-all border border-white/10 hover:border-white/30"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CARD DE INFORMAÇÃO JUSBRASIL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center">
                <ScaleIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Portal Jusbrasil</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
              O Jusbrasil centraliza informações de todos os tribunais (STF, STJ, TRFs, TRTs e TJs). 
              Ao utilizar sua conta Pro, você tem acesso ilimitado a cópias de acórdãos, ementas e peças processuais.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => handleQuickSearch(jusbrasil)}
              className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
            >
              <MagnifyingGlassIcon className="w-5 h-5" />
              Nova Pesquisa
            </button>
            <button
              onClick={() => window.open(jusbrasil.link, '_blank')}
              className="flex-1 py-4 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
            >
              <ArrowTopRightOnSquareIcon className="w-5 h-5" />
              Abrir Site Principal
            </button>
          </div>
        </div>

        <div className="bg-slate-900 text-white rounded-3xl p-8 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ScaleIcon className="w-32 h-32 rotate-12" />
          </div>
          <h4 className="text-indigo-400 font-bold uppercase tracking-widest text-xs mb-4">Dica de Produtividade</h4>
          <p className="text-slate-300 text-sm leading-relaxed relative z-10">
            Mantenha a janela de pesquisa aberta ao lado do seu editor de petições. 
            Isso permite que você consulte a jurisprudência e fundamente suas peças em tempo real, sem alternar abas.
          </p>
          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">
              Login Pro: Mantenha sua sessão ativa no navegador para acesso total.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 flex items-start gap-3">
        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
          <ArrowPathIcon className="w-5 h-5" />
        </div>
        <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          <b>Nota sobre Visualização:</b> Devido às travas de segurança dos tribunais, a pesquisa abre em uma janela suspensa externa. Isso garante que você possa usar todas as funcionalidades do Jusbrasil (incluindo IA e downloads) sem bloqueios técnicos.
        </p>
      </div>
    </div>
  );
};

export default Jurisprudence;
