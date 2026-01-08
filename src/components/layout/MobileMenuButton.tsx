import React from 'react';
import { Menu, X } from 'lucide-react';
import { useStore } from '@nanostores/react';
import { isMobileMenuOpen, toggleMobileMenu } from '../../stores/uiStore';

export default function MobileMenuButton() {
    const $isOpen = useStore(isMobileMenuOpen);

    return (
        <button
            onClick={toggleMobileMenu}
            className="p-2 -ml-2 text-slate-600 hover:text-slate-900 md:hidden transition-colors rounded-lg hover:bg-slate-100"
            aria-label="Toggle menu"
        >
            {$isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
    );
}
