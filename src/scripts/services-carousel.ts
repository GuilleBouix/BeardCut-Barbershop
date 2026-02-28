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

    const slides = Array.from(track.children) as HTMLElement[];
    const totalSlides = slides.length;
    let activeIndex = 0;

    if (totalSlides <= 1) {
        prevButton.disabled = true;
        nextButton.disabled = true;
        return;
    }

    const dots = slides.map((_, index) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.setAttribute('aria-label', `Go to gallery slide ${index + 1}`);
        dot.className = 'h-2.5 w-2.5 rounded-full bg-[#5a5a5a] transition';
        dot.addEventListener('click', () => {
            activeIndex = index;
            updateCarousel();
        });
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

    prevButton.addEventListener('click', () => {
        activeIndex = (activeIndex - 1 + totalSlides) % totalSlides;
        updateCarousel();
    });

    nextButton.addEventListener('click', () => {
        activeIndex = (activeIndex + 1) % totalSlides;
        updateCarousel();
    });

    let autoSlide = window.setInterval(() => {
        activeIndex = (activeIndex + 1) % totalSlides;
        updateCarousel();
    }, 5000);

    const resetAutoSlide = () => {
        window.clearInterval(autoSlide);
        autoSlide = window.setInterval(() => {
            activeIndex = (activeIndex + 1) % totalSlides;
            updateCarousel();
        }, 5000);
    };

    prevButton.addEventListener('click', resetAutoSlide);
    nextButton.addEventListener('click', resetAutoSlide);
    dots.forEach((dot) => dot.addEventListener('click', resetAutoSlide));

    updateCarousel();
};

initServicesCarousel();
document.addEventListener('astro:page-load', initServicesCarousel);
