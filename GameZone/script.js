const filterButtons = document.querySelectorAll('.filter-btn');
const gameCards = document.querySelectorAll('.game-card');
const surpriseButton = document.getElementById('surprise-btn');

const setActiveFilter = (filter) => {
  filterButtons.forEach((button) => {
    const isActive = button.dataset.filter === filter;
    button.classList.toggle('active', isActive);
  });

  gameCards.forEach((card) => {
    const matches = filter === 'all' || card.dataset.category === filter;
    card.classList.toggle('hidden', !matches);
  });
};

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setActiveFilter(button.dataset.filter);
  });
});

surpriseButton.addEventListener('click', () => {
  const visibleCards = [...gameCards].filter((card) => !card.classList.contains('hidden'));
  const chosenCard = visibleCards[Math.floor(Math.random() * visibleCards.length)];

  if (!chosenCard) {
    return;
  }

  chosenCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  chosenCard.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(1.04)' },
      { transform: 'scale(1)' },
    ],
    {
      duration: 500,
      easing: 'ease-in-out',
    }
  );

  const title = chosenCard.dataset.name || 'GameZone pick';
  surpriseButton.textContent = `Picked: ${title}`;

  window.clearTimeout(surpriseButton._resetTimer);
  surpriseButton._resetTimer = window.setTimeout(() => {
    surpriseButton.textContent = 'Surprise me';
  }, 1800);
});
