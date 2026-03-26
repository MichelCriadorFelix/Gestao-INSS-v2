
import React, { useState } from 'react';
import { CheckIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';

const CopyButton = ({ text }: { text: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!text) return;
        
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    if (!text) return null;

    return (
        <button 
            onClick={handleCopy} 
            className={`p-1.5 rounded-lg transition-all duration-200 flex-shrink-0 ${copied ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title="Copiar"
        >
            {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <DocumentDuplicateIcon className="h-3.5 w-3.5" />}
        </button>
    );
};

export default CopyButton;
