import React from 'react';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

const MeuINSS: React.FC = () => {
  const openMeuINSS = () => {
    const width = 900;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    window.open(
      'https://meu.inss.gov.br/#/login',
      'MeuINSS',
      `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=yes,noopener,noreferrer`
    );
  };

  return (
    <div className="h-full w-full p-4 flex flex-col items-center justify-center">
      <h2 className="text-2xl font-bold mb-6">Meu INSS</h2>
      <p className="text-slate-600 mb-8 text-center max-w-md">
        Por questões de segurança, o portal Meu INSS não pode ser aberto diretamente dentro desta página.
        Clique no botão abaixo para acessar o portal em uma nova aba.
      </p>
      <button
        onClick={openMeuINSS}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg"
      >
        <span>Acessar Meu INSS</span>
        <ArrowTopRightOnSquareIcon className="h-5 w-5" />
      </button>
    </div>
  );
};

export default MeuINSS;
