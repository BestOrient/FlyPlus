document.addEventListener('DOMContentLoaded', () => {

  const track = document.querySelector('.carousel-track');
  const cards = document.querySelectorAll('.promo-card');
  const prevBtn = document.querySelector('.carousel-btn.prev');
  const nextBtn = document.querySelector('.carousel-btn.next');

  if (!track || cards.length === 0) return;

  let index = 0;

  const getVisibleCount = () => {
    if (window.innerWidth <= 640) return 1;
    if (window.innerWidth <= 1024) return 2;
    return 3;
  };

  const updateCarousel = () => {
    const gap = 18;
    const cardWidth = cards[0].getBoundingClientRect().width + gap;
    track.style.transform = `translateX(-${index * cardWidth}px)`;
  };

  const goNext = () => {
    const maxIndex = Math.max(0, cards.length - getVisibleCount());
    if (index < maxIndex) {
      index++;
      updateCarousel();
    }
  };

  const goPrev = () => {
    if (index > 0) {
      index--;
      updateCarousel();
    }
  };

  if (nextBtn) nextBtn.addEventListener('click', goNext);
  if (prevBtn) prevBtn.addEventListener('click', goPrev);

  // Свайпы
  let startX = 0;

  track.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
  }, { passive: true });

  track.addEventListener('touchend', (e) => {
    const endX = e.changedTouches[0].clientX;
    const threshold = 50;

    if (startX - endX > threshold) goNext();
    if (endX - startX > threshold) goPrev();
  }, { passive: true });

  // Сброс при ресайзе
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      index = 0;
      updateCarousel();
    }, 150);
  });

  updateCarousel();
});
