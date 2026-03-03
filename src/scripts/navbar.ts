const OPEN_MENU_CLASSES = ['max-h-80', 'opacity-100', 'translate-y-0', 'pointer-events-auto'] as const;
const CLOSED_MENU_CLASSES = ['max-h-0', 'opacity-0', '-translate-y-2', 'pointer-events-none'] as const;

const initNavbarMenu = () => {
    const menuButton = document.getElementById('menu-button') as HTMLButtonElement | null;
    const mobileMenu = document.getElementById('mobile-menu');
    const menuIcon = document.getElementById('icon-menu');
    const closeIcon = document.getElementById('icon-close');
    const navbar = document.getElementById('site-navbar');

    if (!menuButton || !mobileMenu || !menuIcon || !closeIcon || !navbar || menuButton.dataset.ready === 'true') {
        return;
    }

    menuButton.dataset.ready = 'true';

    let isMenuOpen: boolean | null = null;
    let isScrolled = false;
    let scrollFrameRequested = false;

    const setNavbarState = (nextState: boolean) => {
        if (nextState === isScrolled) {
            return;
        }

        isScrolled = nextState;
        navbar.classList.toggle('is-scrolled', nextState);
    };

    const setMenuState = (nextState: boolean) => {
        if (isMenuOpen === nextState) {
            return;
        }

        isMenuOpen = nextState;
        mobileMenu.classList.remove(...(nextState ? CLOSED_MENU_CLASSES : OPEN_MENU_CLASSES));
        mobileMenu.classList.add(...(nextState ? OPEN_MENU_CLASSES : CLOSED_MENU_CLASSES));
        menuIcon.classList.toggle('hidden', nextState);
        closeIcon.classList.toggle('hidden', !nextState);
        menuButton.setAttribute('aria-expanded', String(nextState));
        menuButton.setAttribute('aria-label', nextState ? 'Close menu' : 'Open menu');
    };

    const handleScroll = () => {
        if (scrollFrameRequested) {
            return;
        }

        scrollFrameRequested = true;
        window.requestAnimationFrame(() => {
            scrollFrameRequested = false;
            setNavbarState(window.scrollY > 24);
        });
    };

    setMenuState(false);
    setNavbarState(window.scrollY > 24);

    menuButton.addEventListener('click', () => {
        setMenuState(!(isMenuOpen ?? false));
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

    window.addEventListener('scroll', handleScroll, { passive: true });
};

initNavbarMenu();
document.addEventListener('astro:page-load', initNavbarMenu);
