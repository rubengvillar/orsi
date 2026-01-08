import { atom } from 'nanostores';

export const isMobileMenuOpen = atom(false);

export const toggleMobileMenu = () => {
    isMobileMenuOpen.set(!isMobileMenuOpen.get());
};

export const closeMobileMenu = () => {
    isMobileMenuOpen.set(false);
};
