const AUTOPLAY_INTERVAL_MS = 5000;
const CAROUSEL_THRESHOLD = 0.2;

const initServicesCarousel = () => {
    const carousel = document.querySelector('[data-gallery-carousel]') as HTMLElement | null;
    const track = document.getElementById('gallery-track') as HTMLElement | null;
    const prevButton = document.getElementById('gallery-prev') as HTMLButtonElement | null;
    const nextButton = document.getElementById('gallery-next') as HTMLButtonElement | null;
    const dotsContainer = document.getElementById('gallery-dots') as HTMLElement | null;

    if (!carousel || !track || !prevButton || !nextButton || !dotsContainer || carousel.dataset.ready === 'true') {
        return;
    }

    carousel.dataset.ready = 'true';

    const startWhenVisible = () => {
        const slides = Array.from(track.children) as HTMLElement[];
        const totalSlides = slides.length;
        let activeIndex = 0;

        if (totalSlides <= 1) {
            prevButton.disabled = true;
            nextButton.disabled = true;
            return;
        }

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        let autoSlideId: number | null = null;
        let isInViewport = false;

        const dots = slides.map((_, index) => {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.setAttribute('aria-label', `Go to gallery slide ${index + 1}`);
            dot.className = 'h-2.5 w-2.5 rounded-full bg-[#5a5a5a] transition';
            dotsContainer.appendChild(dot);
            return dot;
        });

        const updateCarousel = () => {
            track.style.transform = `translateX(-${activeIndex * 100}%)`;

            dots.forEach((dot, index) => {
                const isActive = index === activeIndex;
                dot.classList.toggle('bg-white', isActive);
                dot.classList.toggle('w-6', isActive);
                dot.classList.toggle('bg-[#5a5a5a]', !isActive);
                dot.classList.toggle('w-2.5', !isActive);
            });
        };

        const stopAutoSlide = () => {
            if (autoSlideId !== null) {
                window.clearInterval(autoSlideId);
                autoSlideId = null;
            }
        };

        const startAutoSlide = () => {
            stopAutoSlide();

            if (!isInViewport || document.hidden || prefersReducedMotion.matches) {
                return;
            }

            autoSlideId = window.setInterval(() => {
                activeIndex = (activeIndex + 1) % totalSlides;
                updateCarousel();
            }, AUTOPLAY_INTERVAL_MS);
        };

        const resetAutoSlide = () => {
            startAutoSlide();
        };

        prevButton.addEventListener('click', () => {
            activeIndex = (activeIndex - 1 + totalSlides) % totalSlides;
            updateCarousel();
            resetAutoSlide();
        });

        nextButton.addEventListener('click', () => {
            activeIndex = (activeIndex + 1) % totalSlides;
            updateCarousel();
            resetAutoSlide();
        });

        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                activeIndex = index;
                updateCarousel();
                resetAutoSlide();
            });
        });

        const visibilityObserver = new IntersectionObserver((entries) => {
            const [entry] = entries;
            isInViewport = entry.isIntersecting;
            startAutoSlide();
        }, { threshold: CAROUSEL_THRESHOLD });

        const handleVisibilityChange = () => {
            startAutoSlide();
        };

        const handleMotionPreferenceChange = () => {
            startAutoSlide();
        };

        visibilityObserver.observe(carousel);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        if ('addEventListener' in prefersReducedMotion) {
            prefersReducedMotion.addEventListener('change', handleMotionPreferenceChange);
        } else {
            prefersReducedMotion.addListener(handleMotionPreferenceChange);
        }

        document.addEventListener('astro:before-swap', () => {
            stopAutoSlide();
            visibilityObserver.disconnect();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if ('removeEventListener' in prefersReducedMotion) {
                prefersReducedMotion.removeEventListener('change', handleMotionPreferenceChange);
            } else {
                prefersReducedMotion.removeListener(handleMotionPreferenceChange);
            }
        }, { once: true });

        updateCarousel();
    };

    if (!('IntersectionObserver' in window)) {
        startWhenVisible();
        return;
    }

    const bootstrapObserver = new IntersectionObserver((entries) => {
        const [entry] = entries;
        if (!entry.isIntersecting) {
            return;
        }

        bootstrapObserver.disconnect();
        startWhenVisible();
    }, { rootMargin: '100px 0px' });

    bootstrapObserver.observe(carousel);
};

initServicesCarousel();
document.addEventListener('astro:page-load', initServicesCarousel);
