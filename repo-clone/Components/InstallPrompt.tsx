
import React, { useState, useEffect } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

const InstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
            setIsInstalled(true);
        }
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsVisible(true);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setIsVisible(false);
        }
    };

    if (isInstalled || !isVisible) return null;

    return (
        <div className="absolute top-6 right-6 z-50 animate-bounce-slow hidden md:block">
            <button
                onClick={handleInstallClick}
                className="flex items-center gap-3 bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/40 text-white px-5 py-3 rounded-full shadow-2xl transition-all transform hover:scale-105 group"
            >
                <div className="bg-white text-primary-600 p-2 rounded-full shadow-sm">
                    <ArrowDownTrayIcon className="h-5 w-5" />
                </div>
                <div className="text-left">
                    <p className="text-xs font-medium text-slate-200 uppercase tracking-wider">Disponível</p>
                    <p className="font-bold text-sm">Instalar App no PC</p>
                </div>
            </button>
        </div>
    );
};

export default InstallPrompt;
