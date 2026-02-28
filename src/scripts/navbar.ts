const OPEN_MENU_CLASSES = ['max-h-80', 'opacity-100', 'translate-y-0', 'pointer-events-auto'] as const;
const CLOSED_MENU_CLASSES = ['max-h-0', 'opacity-0', '-translate-y-2', 'pointer-events-none'] as const;

const initNavbarMenu = () => {
    const menuButton = document.getElementById('menu-button') as HTMLButtonElement | null;
    const mobileMenu = document.getElementById('mobile-menu');
    const menuIcon = document.getElementById('icon-menu');
    const closeIcon = document.getElementById('icon-close');

    if (!menuButton || !mobileMenu || !menuIcon || !closeIcon || menuButton.dataset.ready === 'true') {
        return;
    }

    menuButton.dataset.ready = 'true';

    const setMenuState = (isOpen: boolean) => {
        mobileMenu.classList.remove(...(isOpen ? CLOSED_MENU_CLASSES : OPEN_MENU_CLASSES));
        mobileMenu.classList.add(...(isOpen ? OPEN_MENU_CLASSES : CLOSED_MENU_CLASSES));
        menuIcon.classList.toggle('hidden', isOpen);
        closeIcon.classList.toggle('hidden', !isOpen);
        menuButton.setAttribute('aria-expanded', String(isOpen));
        menuButton.setAttribute('aria-label', isOpen ? 'Cerrar menú' : 'Abrir menú');
    };

    setMenuState(false);

    menuButton.addEventListener('click', () => {
        const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
        setMenuState(!isOpen);
    });

    mobileMenu.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => setMenuState(false));
    });

    window.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            setMenuState(false);
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth >= 768) {
            setMenuState(false);
        }
    });
};

initNavbarMenu();
document.addEventListener('astro:page-load', initNavbarMenu);
