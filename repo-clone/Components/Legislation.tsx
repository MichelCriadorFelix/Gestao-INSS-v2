import React, { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, BookOpenIcon, ArrowTopRightOnSquareIcon, ArrowLeftIcon, ArrowPathIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Law {
  id: string;
  title: string;
  description: string;
  link: string;
  category: string;
}

interface LegislationProps {
  customLaws: Law[];
  onSaveCustomLaws: (laws: Law[]) => void;
}

const INITIAL_LAWS: Law[] = [
  {
    id: 'cf88',
    title: 'Constituição Federal',
    description: 'Constituição da República Federativa do Brasil de 1988.',
    link: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
    category: 'Constitucional'
  },
  {
    id: 'cf88-stf',
    title: 'A Constituição e o Supremo (STF)',
    description: 'Constituição Federal com anotações de jurisprudência do Supremo Tribunal Federal.',
    link: 'https://constituicao.stf.jus.br/',
    category: 'Constitucional'
  },
  {
    id: 'cc2002',
    title: 'Código Civil (Lei nº 10.406/2002)',
    description: 'Institui o Código Civil.',
    link: 'https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm',
    category: 'Civil'
  },
  {
    id: 'cpc2015',
    title: 'Código de Processo Civil (Lei nº 13.105/2015)',
    description: 'Código de Processo Civil.',
    link: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm',
    category: 'Civil'
  },
  {
    id: 'clt',
    title: 'Consolidação das Leis do Trabalho (Decreto-Lei nº 5.452/1943)',
    description: 'Aprova a Consolidação das Leis do Trabalho.',
    link: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm',
    category: 'Trabalhista'
  },
  {
    id: 'lei-8213',
    title: 'Lei de Benefícios da Previdência Social (Lei nº 8.213/1991)',
    description: 'Dispõe sobre os Planos de Benefícios da Previdência Social e dá outras providências.',
    link: 'https://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm',
    category: 'Previdenciário'
  },
  {
    id: 'lei-8212',
    title: 'Lei Orgânica da Seguridade Social (Lei nº 8.212/1991)',
    description: 'Dispõe sobre a organização da Seguridade Social, institui Plano de Custeio, e dá outras providências.',
    link: 'https://www.planalto.gov.br/ccivil_03/leis/l8212cons.htm',
    category: 'Previdenciário'
  },
  {
    id: 'loas',
    title: 'Lei Orgânica da Assistência Social - LOAS (Lei nº 8.742/1993)',
    description: 'Dispõe sobre a organização da Assistência Social e dá outras providências.',
    link: 'https://www.planalto.gov.br/ccivil_03/leis/l8742.htm',
    category: 'Previdenciário'
  },
  {
    id: 'fgts',
    title: 'Lei do FGTS (Lei nº 8.036/1990)',
    description: 'Dispõe sobre o Fundo de Garantia do Tempo de Serviço, e dá outras providências.',
    link: 'https://www.planalto.gov.br/ccivil_03/leis/l8036consol.htm',
    category: 'Trabalhista'
  },
  {
    id: 'seguro-desemprego',
    title: 'Lei do Seguro-Desemprego (Lei nº 7.998/1990)',
    description: 'Regula o Programa do Seguro-Desemprego, o Abono Salarial, institui o Fundo de Amparo ao Trabalhador (FAT), e dá outras providências.',
    link: 'https://www.planalto.gov.br/ccivil_03/leis/l7998.htm',
    category: 'Trabalhista'
  },
  {
    id: 'domestico',
    title: 'Lei do Trabalho Doméstico (LC nº 150/2015)',
    description: 'Dispõe sobre o contrato de trabalho doméstico.',
    link: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp150.htm',
    category: 'Trabalhista'
  },
  {
    id: 'reforma-trabalhista',
    title: 'Reforma Trabalhista (Lei nº 13.467/2017)',
    description: 'Altera a CLT para adequar a legislação às novas relações de trabalho.',
    link: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2017/lei/l13467.htm',
    category: 'Trabalhista'
  },
  {
    id: 'ec-103',
    title: 'Reforma da Previdência (EC nº 103/2019)',
    description: 'Altera o sistema de previdência social e estabelece regras de transição e disposições transitórias.',
    link: 'https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc103.htm',
    category: 'Previdenciário'
  },
  {
    id: 'decreto-3048',
    title: 'Regulamento da Previdência Social (Decreto nº 3.048/1999)',
    description: 'Aprova o Regulamento da Previdência Social, e dá outras providências.',
    link: 'https://www.planalto.gov.br/ccivil_03/decreto/d3048.htm',
    category: 'Previdenciário'
  },
  {
    id: 'in-128',
    title: 'Instrução Normativa PRES/INSS nº 128/2022',
    description: 'Disciplina as regras, procedimentos e rotinas necessárias à efetiva aplicação das normas de direito previdenciário.',
    link: 'https://www.in.gov.br/en/web/dou/-/instrucao-normativa-pres/inss-n-128-de-28-de-marco-de-2022-389275446',
    category: 'Instruções Normativas'
  },
  {
    id: 'in-77',
    title: 'Instrução Normativa INSS/PRES nº 77/2015',
    description: 'Estabelece rotinas para agilizar e uniformizar o reconhecimento de direitos dos segurados e beneficiários da Previdência Social.',
    link: 'https://www.in.gov.br/materia/-/asset_publisher/Kujrw0TZC2Mb/content/id/32120879/do1-2015-01-22-instrucao-normativa-n-77-de-21-de-janeiro-de-2015-32120750',
    category: 'Instruções Normativas'
  },
  {
    id: 'anexo-iv-3048',
    title: 'Anexo IV - Decreto nº 3.048/1999',
    description: 'Classificação dos Agentes Nocivos para fins de Aposentadoria Especial.',
    link: 'https://www.planalto.gov.br/ccivil_03/decreto/d3048.htm#anexoiv',
    category: 'Atividades Especiais'
  },
  {
    id: 'decreto-53831',
    title: 'Quadro Anexo - Decreto nº 53.831/1964',
    description: 'Quadro das ocupações consideradas penosas, insalubres ou perigosas.',
    link: 'https://www.planalto.gov.br/ccivil_03/decreto/d53831.htm#quadro',
    category: 'Atividades Especiais'
  },
  {
    id: 'decreto-83080',
    title: 'Anexos I e II - Decreto nº 83.080/1979',
    description: 'Anexos com a classificação das atividades profissionais segundo os agentes nocivos.',
    link: 'https://www.planalto.gov.br/ccivil_03/decreto/1970-1979/d83080.htm#anexoi',
    category: 'Atividades Especiais'
  },
  {
    id: 'decreto-2172',
    title: 'Anexo IV - Decreto nº 2.172/1997',
    description: 'Regulamento dos Benefícios da Previdência Social (vigente entre 1997 e 1999).',
    link: 'https://www.planalto.gov.br/ccivil_03/decreto/D2172.htm#anexoiv',
    category: 'Atividades Especiais'
  },
  {
    id: 'temas-stj',
    title: 'Temas Repetitivos do STJ',
    description: 'Teses jurídicas firmadas pelo Superior Tribunal de Justiça sob o rito dos repetitivos.',
    link: 'https://processo.stj.jus.br/repetitivos/temas_repetitivos/',
    category: 'Temas e Teses'
  }
];

const Legislation: React.FC<LegislationProps> = ({ customLaws, onSaveCustomLaws }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [selectedLaw, setSelectedLaw] = useState<Law | null>(null);
  const [iframeKey, setIframeKey] = useState(0);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLaw, setNewLaw] = useState({ title: '', description: '', link: '', category: 'Outros' });

  const allLaws = [...INITIAL_LAWS, ...customLaws];
  const categories = ['Todas', ...Array.from(new Set(allLaws.map(law => law.category)))];

  const filteredLaws = allLaws.filter(law => {
    const matchesSearch = law.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          law.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todas' || law.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddLaw = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLaw.title || !newLaw.link) return;

    const lawToAdd: Law = {
      id: `custom-${Date.now()}`,
      title: newLaw.title,
      description: newLaw.description,
      link: newLaw.link,
      category: newLaw.category || 'Outros'
    };

    onSaveCustomLaws([...customLaws, lawToAdd]);
    setIsModalOpen(false);
    setNewLaw({ title: '', description: '', link: '', category: 'Outros' });
  };

  const handleDeleteCustomLaw = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Tem certeza que deseja remover esta lei personalizada?')) {
      onSaveCustomLaws(customLaws.filter(law => law.id !== id));
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Constitucional':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400';
      case 'Civil':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
      case 'Trabalhista':
        return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400';
      case 'Previdenciário':
      case 'Previdenciária':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
      case 'Instruções Normativas':
        return 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400';
      case 'Atividades Especiais':
        return 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400';
      case 'Temas e Teses':
        return 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400';
      default:
        return 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400';
    }
  };

  if (selectedLaw) {
    return (
      <div className="flex flex-col h-[calc(100vh-120px)] bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedLaw(null)}
              className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title="Voltar para a lista"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-1">
                {selectedLaw.title}
              </h2>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getCategoryColor(selectedLaw.category)}`}>
                {selectedLaw.category}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIframeKey(k => k + 1)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Voltar para a lei original"
            >
              <ArrowPathIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Recarregar Lei Original</span>
            </button>
            <a
              href={selectedLaw.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
              title="Abrir em nova aba"
            >
              <span className="hidden sm:inline">Abrir no navegador</span>
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </a>
          </div>
        </div>
        <div className="flex-1 w-full bg-white">
          <iframe
            key={iframeKey}
            src={selectedLaw.link}
            className="w-full h-full border-none"
            title={selectedLaw.title}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpenIcon className="w-6 h-6 text-primary-500" />
              Legislação e Normas
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Acesse rapidamente as principais leis, códigos e instruções normativas.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors whitespace-nowrap"
          >
            <PlusIcon className="w-5 h-5" />
            Adicionar Lei
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar lei por nome ou descrição..."
              className="pl-10 pr-4 py-2 w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLaws.map((law) => (
            <button
              key={law.id}
              onClick={() => setSelectedLaw(law)}
              className="text-left block p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getCategoryColor(law.category)}`}>
                  {law.category}
                </span>
                <div className="flex items-center gap-2">
                  {law.id.startsWith('custom-') && (
                    <button
                      onClick={(e) => handleDeleteCustomLaw(e, law.id)}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                      title="Remover lei"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  )}
                  <ArrowTopRightOnSquareIcon className="w-5 h-5 text-slate-400 group-hover:text-primary-500 transition-colors" />
                </div>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 line-clamp-2">
                {law.title}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3">
                {law.description}
              </p>
            </button>
          ))}
          {filteredLaws.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500 dark:text-slate-400">
              Nenhuma lei encontrada para a sua busca.
            </div>
          )}
        </div>
      </div>

      {/* Modal Adicionar Lei */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Adicionar Nova Lei</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddLaw} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Título da Lei *
                </label>
                <input
                  type="text"
                  required
                  value={newLaw.title}
                  onChange={e => setNewLaw({ ...newLaw, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="Ex: Lei do Inquilinato"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Link (URL) *
                </label>
                <input
                  type="url"
                  required
                  value={newLaw.link}
                  onChange={e => setNewLaw({ ...newLaw, link: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Categoria
                </label>
                <input
                  type="text"
                  value={newLaw.category}
                  onChange={e => setNewLaw({ ...newLaw, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="Ex: Civil, Penal, Outros"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Descrição
                </label>
                <textarea
                  value={newLaw.description}
                  onChange={e => setNewLaw({ ...newLaw, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none resize-none h-24"
                  placeholder="Breve descrição sobre a lei..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
                >
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Legislation;
