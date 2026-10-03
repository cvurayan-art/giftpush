// ================================================== //
// NEVER THE WRONG GIFT - INTERACTIVE CONTROLLERS      //
// ================================================== //

document.addEventListener('DOMContentLoaded', () => {



  // 2. MOBILE DRAWER NAVIGATION
  const mobileToggle = document.getElementById('btn-mobile-toggle');
  const mobileDrawer = document.getElementById('mobile-nav-drawer');
  const closeMobileNav = document.getElementById('btn-close-mobile-nav');

  if (mobileToggle && mobileDrawer) {
    mobileToggle.addEventListener('click', () => {
      mobileDrawer.classList.add('open');
    });
  }

  if (closeMobileNav && mobileDrawer) {
    closeMobileNav.addEventListener('click', () => {
      mobileDrawer.classList.remove('open');
    });
  }

  // Close drawer on clicking mobile links
  document.querySelectorAll('.mobile-link').forEach(link => {
    link.addEventListener('click', () => {
      if (mobileDrawer) mobileDrawer.classList.remove('open');
    });
  });


  // 3. SHOPPING CART DRAWER
  const cartTrigger = document.getElementById('btn-cart-trigger');
  const cartOverlay = document.getElementById('cart-drawer-overlay');
  const closeCartBtn = document.getElementById('btn-close-cart');
  const cartCountBadge = document.getElementById('cart-count');
  const cartDrawerCount = document.getElementById('cart-drawer-count');

  if (cartTrigger && cartOverlay) {
    cartTrigger.addEventListener('click', () => {
      cartOverlay.classList.add('active');
    });
  }

  if (closeCartBtn && cartOverlay) {
    closeCartBtn.addEventListener('click', () => {
      cartOverlay.classList.remove('active');
    });
  }

  if (cartOverlay) {
    cartOverlay.addEventListener('click', (e) => {
      if (e.target === cartOverlay) {
        cartOverlay.classList.remove('active');
      }
    });
  }

  // Cart item removal handler
  const removeButtons = document.querySelectorAll('.remove-item-btn');
  removeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const item = e.target.closest('.cart-item');
      if (item) {
        item.style.opacity = '0';
        item.style.transform = 'scale(0.9)';
        setTimeout(() => {
          item.remove();
          updateCartTotals();
        }, 200);
      }
    });
  });

  function updateCartTotals() {
    const items = document.querySelectorAll('.cart-item');
    const count = items.length;
    if (cartCountBadge) cartCountBadge.textContent = count;
    if (cartDrawerCount) cartDrawerCount.textContent = count;

    let subtotal = 0;
    items.forEach(item => {
      const priceText = item.querySelector('.cart-item-price')?.textContent.replace('$', '') || '0';
      subtotal += parseFloat(priceText);
    });

    const subtotalEl = document.querySelector('.subtotal-amount');
    if (subtotalEl) {
      subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    }
  }


  // 4. SEARCH MODAL
  const searchTrigger = document.getElementById('btn-search-trigger');
  const searchOverlay = document.getElementById('search-modal-overlay');
  const closeSearchBtn = document.getElementById('btn-close-search');
  const searchInput = document.getElementById('search-input');

  if (searchTrigger && searchOverlay) {
    searchTrigger.addEventListener('click', () => {
      searchOverlay.classList.add('active');
      setTimeout(() => {
        if (searchInput) searchInput.focus();
      }, 100);
    });
  }

  if (closeSearchBtn && searchOverlay) {
    closeSearchBtn.addEventListener('click', () => {
      searchOverlay.classList.remove('active');
    });
  }

  if (searchOverlay) {
    searchOverlay.addEventListener('click', (e) => {
      if (e.target === searchOverlay) {
        searchOverlay.classList.remove('active');
      }
    });
  }

  // Quick tag click fills input
  document.querySelectorAll('.tag-btn').forEach(tag => {
    tag.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = tag.textContent;
        searchInput.focus();
      }
    });
  });


  // 5. GUEST REVIEW MODAL
  const openReviewBtn = document.getElementById('btn-open-review-modal');
  const reviewOverlay = document.getElementById('review-modal-overlay');
  const closeReviewBtn = document.getElementById('btn-close-review');

  if (openReviewBtn && reviewOverlay) {
    openReviewBtn.addEventListener('click', () => {
      reviewOverlay.classList.add('active');
    });
  }

  if (closeReviewBtn && reviewOverlay) {
    closeReviewBtn.addEventListener('click', () => {
      reviewOverlay.classList.remove('active');
    });
  }

  if (reviewOverlay) {
    reviewOverlay.addEventListener('click', (e) => {
      if (e.target === reviewOverlay) {
        reviewOverlay.classList.remove('active');
      }
    });
  }


  // 6. VIDEO GUIDE MODAL
  const watchVideoBtn = document.getElementById('btn-watch-video');
  const videoOverlay = document.getElementById('video-modal-overlay');
  const closeVideoBtn = document.getElementById('btn-close-video');

  if (watchVideoBtn && videoOverlay) {
    watchVideoBtn.addEventListener('click', () => {
      videoOverlay.classList.add('active');
    });
  }

  if (closeVideoBtn && videoOverlay) {
    closeVideoBtn.addEventListener('click', () => {
      videoOverlay.classList.remove('active');
    });
  }

  if (videoOverlay) {
    videoOverlay.addEventListener('click', (e) => {
      if (e.target === videoOverlay) {
        videoOverlay.classList.remove('active');
      }
    });
  }


  // 7. TESTIMONIAL CAROUSEL SLIDER
  const testimonialsContainer = document.getElementById('testimonials-container');
  const prevBtn = document.getElementById('testimonial-prev');
  const nextBtn = document.getElementById('testimonial-next');
  const testimonialCards = document.querySelectorAll('.testimonial-card');

  let currentIndex = 0;

  function isMobileView() {
    return window.innerWidth <= 992;
  }

  function updateTestimonials() {
    if (isMobileView()) {
      testimonialCards.forEach((card, idx) => {
        if (idx === currentIndex) {
          card.style.display = 'flex';
          card.style.opacity = '1';
        } else {
          card.style.display = 'none';
        }
      });
    } else {
      testimonialCards.forEach(card => {
        card.style.display = 'flex';
        card.style.opacity = '1';
      });
    }
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentIndex = (currentIndex - 1 + testimonialCards.length) % testimonialCards.length;
      updateTestimonials();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % testimonialCards.length;
      updateTestimonials();
    });
  }

  window.addEventListener('resize', updateTestimonials);
  updateTestimonials();


  // 8. TOAST NOTIFICATION UTILITY
  function showToast(message) {
    let toast = document.getElementById('toast-notification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast-notification';
      toast.className = 'toast-notification';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B79A62" stroke-width="2">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
      <span>${message}</span>
    `;
    toast.classList.add('active');
    setTimeout(() => {
      toast.classList.remove('active');
    }, 2800);
  }


  // 9. LIVE CHRISTMAS COUNTDOWN (Promo Banner & Seasonal Section)
  function initChristmasCountdown() {
    const currentYear = new Date().getFullYear();
    let targetChristmas = new Date(currentYear, 11, 25, 0, 0, 0);
    // If Christmas this year already passed, count down to next year
    if (new Date() > targetChristmas) {
      targetChristmas = new Date(currentYear + 1, 11, 25, 0, 0, 0);
    }

    function updateTimers() {
      const now = new Date().getTime();
      const distance = targetChristmas.getTime() - now;

      if (distance < 0) return;

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      const pad = (n) => String(n).padStart(2, '0');

      // Promo banner timer
      const pDays = document.getElementById('timer-days');
      const pHours = document.getElementById('timer-hours');
      const pMins = document.getElementById('timer-mins');
      const pSecs = document.getElementById('timer-secs');
      if (pDays) pDays.textContent = pad(days);
      if (pHours) pHours.textContent = pad(hours);
      if (pMins) pMins.textContent = pad(minutes);
      if (pSecs) pSecs.textContent = pad(seconds);

      // Seasonal moment section timer
      const sDays = document.getElementById('seasonal-days');
      const sHours = document.getElementById('seasonal-hours');
      const sMins = document.getElementById('seasonal-mins');
      const sSecs = document.getElementById('seasonal-secs');
      if (sDays) sDays.textContent = pad(days);
      if (sHours) sHours.textContent = pad(hours);
      if (sMins) sMins.textContent = pad(minutes);
      if (sSecs) sSecs.textContent = pad(seconds);
    }

    updateTimers();
    setInterval(updateTimers, 1000);
  }
  initChristmasCountdown();


  // 10. SNOW PARTICLES GENERATOR
  function initSnowParticles() {
    const snowContainer = document.getElementById('snow-particles');
    if (!snowContainer) return;

    const count = 35;
    for (let i = 0; i < count; i++) {
      const flake = document.createElement('div');
      flake.className = 'snowflake-dot';
      const size = Math.random() * 4 + 2;
      flake.style.width = `${size}px`;
      flake.style.height = `${size}px`;
      flake.style.left = `${Math.random() * 100}%`;
      flake.style.opacity = (Math.random() * 0.7 + 0.3).toString();
      flake.style.animationDuration = `${Math.random() * 4 + 4}s`;
      flake.style.animationDelay = `${Math.random() * 5}s`;
      snowContainer.appendChild(flake);
    }
  }
  initSnowParticles();


  // 11. DYNAMIC ADD TO CART FOR BESTSELLERS & PRODUCTS
  function addProductToCart(title, price, img) {
    const cartBody = document.querySelector('.cart-drawer-body');
    if (cartBody) {
      const newItem = document.createElement('div');
      newItem.className = 'cart-item';
      newItem.innerHTML = `
        <img src="${img}" alt="${title}" class="cart-item-img">
        <div class="cart-item-details">
          <h4>${title}</h4>
          <p class="cart-item-price">$${parseFloat(price).toFixed(2)}</p>
          <div class="cart-item-qty">
            <span>Qty: 1</span>
          </div>
        </div>
        <button class="remove-item-btn" aria-label="Remove item">&times;</button>
      `;

      newItem.querySelector('.remove-item-btn').addEventListener('click', () => {
        newItem.style.opacity = '0';
        newItem.style.transform = 'scale(0.9)';
        setTimeout(() => {
          newItem.remove();
          updateCartTotals();
        }, 200);
      });

      cartBody.appendChild(newItem);
      updateCartTotals();
    }
    showToast(`Added "${title}" to your Shopping Bag!`);
  }

  document.querySelectorAll('.btn-add-product').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const title = btn.getAttribute('data-name') || 'Handcrafted Gift';
      const price = btn.getAttribute('data-price') || '24.00';
      const img = btn.getAttribute('data-img') || 'images/cozy_mug.jpg';
      addProductToCart(title, price, img);
    });
  });


  // 12. WISHLIST TOGGLE BUTTONS
  document.querySelectorAll('.wishlist-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isActive = btn.classList.toggle('active');
      const productName = btn.getAttribute('data-product') || 'Gift Item';
      if (isActive) {
        btn.setAttribute('aria-label', `Remove ${productName} from wishlist`);
        showToast(`Saved "${productName}" to your Holiday Wishlist!`);
      } else {
        btn.setAttribute('aria-label', `Add ${productName} to wishlist`);
        showToast(`Removed "${productName}" from Wishlist.`);
      }
    });
  });


  // 13. LIVE SEARCH FILTER IN SEARCH MODAL
  const productsCatalog = [
    { name: 'Personalized Christmas Mug', category: 'Personalized Gifts', price: '$24.00', img: 'images/cozy_mug.jpg', link: '#bestsellers' },
    { name: 'Engraved Family Keepsake Box', category: 'Personalized Gifts', price: '$49.00', img: 'images/personalized_box.jpg', link: '#bestsellers' },
    { name: 'Christmas Memory Ornament', category: 'Ornaments', price: '$18.00', img: 'images/tree_ornament.jpg', link: '#bestsellers' },
    { name: 'Luxury Christmas Gift Basket', category: 'Gift Hampers', price: '$69.00', img: 'images/gift_hamper.jpg', link: '#bestsellers' },
    { name: 'Winter Cashmere Gift Box For Her', category: 'Gifts For Her', price: '$75.00', img: 'images/guide_her.jpg', link: '#gift-guide' },
    { name: 'Gentleman Chronograph & Leather Set', category: 'Gifts For Him', price: '$85.00', img: 'images/guide_him.jpg', link: '#gift-guide' },
    { name: 'Holiday Wooden Express & Teddy', category: 'Gifts For Kids', price: '$42.00', img: 'images/guide_kids.jpg', link: '#gift-guide' },
    { name: 'Heartfelt Artisan Honey & Tea Basket', category: 'Thank You Gifts', price: '$38.00', img: 'images/occasion_thankyou.jpg', link: '#occasions' },
    { name: 'Handcrafted Festive Candle', category: 'Stocking Stuffers', price: '$22.00', img: 'images/cinnamon_candle.jpg', link: '#budget' }
  ];

  const searchBox = document.querySelector('.search-modal-box .modal-body');
  if (searchInput && searchBox) {
    let resultsContainer = document.getElementById('search-results-list');
    if (!resultsContainer) {
      resultsContainer = document.createElement('div');
      resultsContainer.id = 'search-results-list';
      resultsContainer.className = 'search-results-list';
      searchBox.appendChild(resultsContainer);
    }

    function executeSearch(query) {
      const q = query.trim().toLowerCase();
      if (!q) {
        resultsContainer.innerHTML = '';
        return;
      }

      const matches = productsCatalog.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.category.toLowerCase().includes(q)
      );

      if (matches.length > 0) {
        resultsContainer.innerHTML = matches.map(p => `
          <a href="${p.link}" class="search-result-item" onclick="document.getElementById('search-modal-overlay').classList.remove('active')">
            <img src="${p.img}" alt="${p.name}" class="search-result-thumb">
            <div class="search-result-info">
              <h5>${p.name}</h5>
              <span>${p.price} • ${p.category}</span>
            </div>
          </a>
        `).join('');
      } else {
        resultsContainer.innerHTML = `
          <div class="search-empty-state">
            <p><strong>We couldn't find that gift.</strong></p>
            <p>Try another search or explore our popular collections.</p>
          </div>
        `;
      }
    }

    searchInput.addEventListener('input', (e) => executeSearch(e.target.value));

    // Support quick search tags
    document.querySelectorAll('.tag-btn').forEach(tag => {
      tag.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = tag.textContent;
          executeSearch(tag.textContent);
        }
      });
    });
  }


  // 14. IMAGE ERROR FALLBACK (Broken image prevention)
  document.querySelectorAll('img').forEach(img => {
    img.addEventListener('error', function() {
      const altText = this.getAttribute('alt') || 'Never The Wrong Gift';
      const parent = this.parentElement;
      if (parent) {
        this.style.display = 'none';
        const fallback = document.createElement('div');
        fallback.className = 'img-fallback';
        fallback.style.width = '100%';
        fallback.style.height = '100%';
        fallback.style.minHeight = '180px';
        fallback.innerHTML = `
          <div style="text-align: center; padding: 20px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#A72D32" stroke-width="1.8" style="margin-bottom: 8px;">
              <rect x="3" y="8" width="18" height="13" rx="2"></rect>
              <path d="M12 8v13"></path>
              <path d="M19 12H5"></path>
            </svg>
            <p style="font-size: 0.8rem; color: #26351F; font-weight: 600;">${altText}</p>
          </div>
        `;
        parent.appendChild(fallback);
      }
    });
  });

  // 15. GIFT FINDER QUIZ & WELCOME ONBOARDING
  const quizOverlay = document.getElementById('gift-quiz-modal-overlay');
  const quizCardWrapper = document.getElementById('quiz-card-wrapper');
  const quizStepContent = document.getElementById('quiz-body-content');
  const quizProgressPills = document.getElementById('quiz-progress-pills');
  const quizStepCounter = document.getElementById('quiz-step-counter');
  const btnQuizPrev = document.getElementById('btn-quiz-prev');
  const btnQuizSkip = document.getElementById('btn-quiz-skip');
  const btnCloseQuiz = document.getElementById('btn-close-gift-quiz');
  const quizResultsWrapper = document.getElementById('quiz-recommendations-wrapper');
  const quizHeroHeadline = document.getElementById('quiz-main-headline');

  // Trigger elements
  const btnHeaderQuiz = document.getElementById('btn-quiz-trigger');
  const btnMobileQuiz = document.getElementById('btn-mobile-quiz');
  const floatingQuizTrigger = document.getElementById('floating-quiz-trigger');

  // Questions definition
  const quizQuestions = [
    {
      id: 'who',
      title: 'Who is it for?',
      options: ['Mum', 'Dad', 'Partner', 'Friend', 'Colleague', 'Teacher', 'Kid', 'Grandparents']
    },
    {
      id: 'occasion',
      title: "What's the occasion?",
      options: ['Christmas Holiday', 'Birthday', 'Anniversary', 'Thank You', 'Just Because', 'Housewarming']
    },
    {
      id: 'vibe',
      title: "What's their vibe?",
      options: ['Cozy & Warm', 'Sentimental & Heartfelt', 'Luxury & Pampering', 'Practical & Classic', 'Playful & Festive']
    },
    {
      id: 'type',
      title: 'What style of gift do they love?',
      options: ['Personalized Keepsake', 'Gourmet Hamper & Treats', 'Home Fragrance & Decor', 'Wearable & Fashion', 'Surprise Me with the Best']
    },
    {
      id: 'budget',
      title: "What's your ideal budget?",
      options: ['Under $25', '$25 – $50', '$50 – $100', 'Luxury $100+']
    }
  ];

  // Comprehensive Product Catalog for smart recommendations
  const quizProducts = [
    {
      id: 'p1',
      name: 'Personalized Christmas Mug',
      category: 'Personalized Keepsakes',
      price: 24.00,
      priceFormatted: '$24.00',
      oldPriceFormatted: '$30.00',
      img: 'images/cozy_mug.jpg',
      badge: '⭐ 98% Match',
      targetWho: ['Mum', 'Dad', 'Partner', 'Friend', 'Colleague', 'Teacher', 'Grandparents'],
      occasions: ['Christmas Holiday', 'Birthday', 'Thank You', 'Just Because'],
      vibes: ['Cozy & Warm', 'Sentimental & Heartfelt'],
      types: ['Personalized Keepsake', 'Home Fragrance & Decor', 'Surprise Me with the Best'],
      budgetTier: 'Under $25'
    },
    {
      id: 'p2',
      name: 'Engraved Family Keepsake Box',
      category: 'Handcrafted Woodwork',
      price: 49.00,
      priceFormatted: '$49.00',
      oldPriceFormatted: '$59.00',
      img: 'images/personalized_box.jpg',
      badge: '✨ Top Heirloom Pick',
      targetWho: ['Partner', 'Mum', 'Dad', 'Grandparents', 'Friend'],
      occasions: ['Christmas Holiday', 'Anniversary', 'Birthday', 'Housewarming'],
      vibes: ['Sentimental & Heartfelt', 'Practical & Classic', 'Luxury & Pampering'],
      types: ['Personalized Keepsake', 'Home Fragrance & Decor', 'Surprise Me with the Best'],
      budgetTier: '$25 – $50'
    },
    {
      id: 'p3',
      name: 'Christmas Memory Tree Ornament',
      category: 'Holiday Keepsakes',
      price: 18.00,
      priceFormatted: '$18.00',
      img: 'images/tree_ornament.jpg',
      badge: '🎄 Holiday Favorite',
      targetWho: ['Friend', 'Teacher', 'Colleague', 'Grandparents', 'Mum', 'Kid'],
      occasions: ['Christmas Holiday', 'Thank You', 'Just Because'],
      vibes: ['Sentimental & Heartfelt', 'Playful & Festive', 'Cozy & Warm'],
      types: ['Personalized Keepsake', 'Home Fragrance & Decor', 'Surprise Me with the Best'],
      budgetTier: 'Under $25'
    },
    {
      id: 'p4',
      name: 'Luxury Christmas Gourmet Gift Hamper',
      category: 'Luxury Hampers',
      price: 69.00,
      priceFormatted: '$69.00',
      oldPriceFormatted: '$85.00',
      img: 'images/gift_hamper.jpg',
      badge: '🌟 Opulent Treat',
      targetWho: ['Partner', 'Colleague', 'Dad', 'Mum', 'Grandparents', 'Friend'],
      occasions: ['Christmas Holiday', 'Anniversary', 'Thank You', 'Housewarming'],
      vibes: ['Luxury & Pampering', 'Cozy & Warm'],
      types: ['Gourmet Hamper & Treats', 'Surprise Me with the Best'],
      budgetTier: '$50 – $100'
    },
    {
      id: 'p5',
      name: 'Winter Cashmere Gift Box For Her',
      category: 'Gifts For Her',
      price: 75.00,
      priceFormatted: '$75.00',
      img: 'images/guide_her.jpg',
      badge: '💖 Pure Indulgence',
      targetWho: ['Mum', 'Partner', 'Friend', 'Teacher', 'Grandparents'],
      occasions: ['Christmas Holiday', 'Birthday', 'Anniversary'],
      vibes: ['Luxury & Pampering', 'Cozy & Warm', 'Sentimental & Heartfelt'],
      types: ['Wearable & Fashion', 'Home Fragrance & Decor', 'Surprise Me with the Best'],
      budgetTier: '$50 – $100'
    },
    {
      id: 'p6',
      name: 'Gentleman Chronograph & Leather Set',
      category: 'Gifts For Him',
      price: 85.00,
      priceFormatted: '$85.00',
      img: 'images/guide_him.jpg',
      badge: '🎩 Distinguished Classic',
      targetWho: ['Dad', 'Partner', 'Colleague', 'Friend'],
      occasions: ['Christmas Holiday', 'Birthday', 'Anniversary'],
      vibes: ['Practical & Classic', 'Luxury & Pampering'],
      types: ['Wearable & Fashion', 'Personalized Keepsake', 'Surprise Me with the Best'],
      budgetTier: '$50 – $100'
    },
    {
      id: 'p7',
      name: 'Holiday Wooden Express Train & Teddy',
      category: 'Kids & Nostalgia',
      price: 42.00,
      priceFormatted: '$42.00',
      img: 'images/guide_kids.jpg',
      badge: '🧸 Magical Wonder',
      targetWho: ['Kid', 'Grandparents'],
      occasions: ['Christmas Holiday', 'Birthday', 'Just Because'],
      vibes: ['Playful & Festive', 'Sentimental & Heartfelt'],
      types: ['Surprise Me with the Best', 'Personalized Keepsake'],
      budgetTier: '$25 – $50'
    },
    {
      id: 'p8',
      name: 'Artisan Cinnamon Spice & Pine Candle',
      category: 'Home & Aromatherapy',
      price: 22.00,
      priceFormatted: '$22.00',
      img: 'images/cinnamon_candle.jpg',
      badge: '🕯️ Warm Holiday Glow',
      targetWho: ['Teacher', 'Colleague', 'Friend', 'Mum', 'Partner'],
      occasions: ['Christmas Holiday', 'Thank You', 'Just Because', 'Housewarming'],
      vibes: ['Cozy & Warm', 'Luxury & Pampering'],
      types: ['Home Fragrance & Decor', 'Surprise Me with the Best'],
      budgetTier: 'Under $25'
    },
    {
      id: 'p9',
      name: 'Gold-Embossed Holiday Keepsake Journal',
      category: 'Keepsakes & Stationery',
      price: 36.00,
      priceFormatted: '$36.00',
      img: 'images/holiday_journal.jpg',
      badge: '✒️ Thoughtful Choice',
      targetWho: ['Partner', 'Friend', 'Teacher', 'Colleague', 'Mum', 'Dad'],
      occasions: ['Christmas Holiday', 'Birthday', 'Thank You', 'Just Because'],
      vibes: ['Practical & Classic', 'Sentimental & Heartfelt'],
      types: ['Personalized Keepsake', 'Wearable & Fashion', 'Surprise Me with the Best'],
      budgetTier: '$25 – $50'
    },
    {
      id: 'p10',
      name: 'Personalized Heirloom Cable Knit Stocking',
      category: 'Festive Traditions',
      price: 28.00,
      priceFormatted: '$28.00',
      img: 'images/knit_stocking.jpg',
      badge: '🎅 Cozy Tradition',
      targetWho: ['Kid', 'Mum', 'Dad', 'Grandparents', 'Partner', 'Friend'],
      occasions: ['Christmas Holiday'],
      vibes: ['Cozy & Warm', 'Playful & Festive', 'Sentimental & Heartfelt'],
      types: ['Personalized Keepsake', 'Home Fragrance & Decor', 'Surprise Me with the Best'],
      budgetTier: '$25 – $50'
    }
  ];

  let currentQuizStep = 0;
  let quizAnswers = {
    who: '',
    occasion: '',
    vibe: '',
    type: '',
    budget: ''
  };

  function openGiftQuiz() {
    if (!quizOverlay) return;
    quizOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (quizCardWrapper && quizCardWrapper.style.display === 'none') {
      renderQuizStep(currentQuizStep);
    }
  }

  function closeGiftQuiz() {
    if (!quizOverlay) return;
    quizOverlay.classList.remove('active');
    document.body.style.overflow = '';
    sessionStorage.setItem('gift_quiz_welcomed', 'true');
    const modalContainer = quizOverlay.querySelector('.quiz-modal-container');
    if (modalContainer) modalContainer.classList.remove('has-results');
  }

  function renderQuizStep(stepIdx) {
    if (!quizStepContent) return;
    currentQuizStep = stepIdx;

    const modalContainer = quizOverlay ? quizOverlay.querySelector('.quiz-modal-container') : null;
    if (modalContainer) modalContainer.classList.remove('has-results');

    if (quizCardWrapper) {
      quizCardWrapper.style.display = 'flex';
      quizCardWrapper.style.flexDirection = 'column';
    }
    if (quizResultsWrapper) quizResultsWrapper.style.display = 'none';
    if (quizHeroHeadline) quizHeroHeadline.innerHTML = 'Answer 5 questions. Get the<br>perfect gift.';

    const q = quizQuestions[stepIdx];

    // Update dashes
    if (quizProgressPills) {
      const dashes = quizProgressPills.querySelectorAll('.quiz-pill-dash');
      dashes.forEach((dash, idx) => {
        dash.classList.remove('active', 'completed');
        if (idx === stepIdx) {
          dash.classList.add('active');
        } else if (idx < stepIdx) {
          dash.classList.add('completed');
        }
      });
    }

    // Update Counter
    if (quizStepCounter) {
      quizStepCounter.textContent = `${stepIdx + 1} / 5`;
    }

    // Update Back button visibility
    if (btnQuizPrev) {
      if (stepIdx > 0) {
        btnQuizPrev.style.opacity = '1';
        btnQuizPrev.style.pointerEvents = 'auto';
      } else {
        btnQuizPrev.style.opacity = '0';
        btnQuizPrev.style.pointerEvents = 'none';
      }
    }

    // Render HTML with animation
    quizStepContent.className = 'quiz-body-content fade-enter';
    quizStepContent.innerHTML = `
      <h3 class="quiz-question-title">${q.title}</h3>
      <div class="quiz-options-group">
        ${q.options.map(opt => `
          <button type="button" class="quiz-option-pill ${quizAnswers[q.id] === opt ? 'selected' : ''}" data-value="${opt}">
            ${opt}
          </button>
        `).join('')}
      </div>
    `;

    // Attach pill click events
    quizStepContent.querySelectorAll('.quiz-option-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const val = pill.getAttribute('data-value');
        quizAnswers[q.id] = val;

        quizStepContent.querySelectorAll('.quiz-option-pill').forEach(p => p.classList.remove('selected'));
        pill.classList.add('selected');

        setTimeout(() => {
          if (stepIdx < quizQuestions.length - 1) {
            renderQuizStep(stepIdx + 1);
          } else {
            showQuizResults();
          }
        }, 220);
      });
    });
  }

  function showQuizResults() {
    const modalContainer = quizOverlay ? quizOverlay.querySelector('.quiz-modal-container') : null;
    if (modalContainer) modalContainer.classList.add('has-results');

    if (quizCardWrapper) quizCardWrapper.style.display = 'none';
    if (quizResultsWrapper) {
      quizResultsWrapper.style.display = 'flex';
      quizResultsWrapper.style.flexDirection = 'column';
    }
    if (quizHeroHeadline) quizHeroHeadline.innerHTML = 'Your Curated Gift Matches';

    quizResultsWrapper.innerHTML = `
      <div class="quiz-loading-box">
        <div class="quiz-loading-spinner"></div>
        <p>✨ Curating tailored holiday gifts for <strong>${quizAnswers.who || 'someone special'}</strong>...</p>
      </div>
    `;

    setTimeout(() => {
      const scoredProducts = quizProducts.map(p => {
        let score = 0;
        if (quizAnswers.who && p.targetWho.includes(quizAnswers.who)) score += 4;
        if (quizAnswers.occasion && p.occasions.includes(quizAnswers.occasion)) score += 3;
        if (quizAnswers.vibe && p.vibes.includes(quizAnswers.vibe)) score += 3;
        if (quizAnswers.type && p.types.includes(quizAnswers.type)) score += 2;
        if (quizAnswers.budget && p.budgetTier === quizAnswers.budget) score += 3;
        return { ...p, score };
      });

      scoredProducts.sort((a, b) => b.score - a.score);
      const topMatches = scoredProducts.slice(0, 3);

      quizResultsWrapper.innerHTML = `
        <div class="results-header">
          <span class="results-badge-eyebrow">TAILORED RECOMMENDATIONS</span>
          <h3 class="results-title">Handpicked for ${quizAnswers.who || 'Your Loved One'}</h3>
          <p class="results-criteria-summary">
            Selected for: <strong>${quizAnswers.who || 'Someone Special'}</strong> • 
            <strong>${quizAnswers.occasion || 'Christmas'}</strong> • 
            <strong>${quizAnswers.budget || 'Any Budget'}</strong>
          </p>
        </div>

        <div class="results-products-grid">
          ${topMatches.map(item => `
            <article class="result-product-card">
              <div class="result-img-wrap">
                <span class="result-match-tag">${item.badge}</span>
                <img src="${item.img}" alt="${item.name}" loading="lazy">
              </div>
              <div class="result-card-details">
                <span class="result-product-cat">${item.category}</span>
                <h4 class="result-product-title">${item.name}</h4>
                <div class="result-price-row">
                  <span class="result-price">${item.priceFormatted}</span>
                  ${item.oldPriceFormatted ? `<span class="result-old-price">${item.oldPriceFormatted}</span>` : ''}
                </div>
                <button type="button" class="result-add-btn" data-name="${item.name}" data-price="${item.price}" data-img="${item.img}">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                  </svg>
                  <span>Add to Bag</span>
                </button>
              </div>
            </article>
          `).join('')}
        </div>

        <div class="results-action-row">
          <button type="button" class="btn-quiz-retake" id="btn-quiz-retake">
            ↺ Retake Quiz
          </button>
          <button type="button" class="btn-quiz-browse-store" id="btn-quiz-browse-store">
            Explore All Gifts &rarr;
          </button>
        </div>
      `;

      // Wire add-to-bag buttons inside results
      quizResultsWrapper.querySelectorAll('.result-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const name = btn.getAttribute('data-name');
          const price = btn.getAttribute('data-price');
          const img = btn.getAttribute('data-img');

          addProductToCart(name, price, img);
          btn.classList.add('added');
          btn.innerHTML = `<span>✓ Added to Bag!</span>`;
          setTimeout(() => {
            btn.classList.remove('added');
            btn.innerHTML = `
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
              </svg>
              <span>Add to Bag</span>
            `;
          }, 2400);
        });
      });

      // Wire Retake & Browse buttons
      const retakeBtn = document.getElementById('btn-quiz-retake');
      if (retakeBtn) {
        retakeBtn.addEventListener('click', () => {
          const modalContainer = quizOverlay ? quizOverlay.querySelector('.quiz-modal-container') : null;
          if (modalContainer) modalContainer.classList.remove('has-results');
          quizAnswers = { who: '', occasion: '', vibe: '', type: '', budget: '' };
          renderQuizStep(0);
        });
      }

      const browseStoreBtn = document.getElementById('btn-quiz-browse-store');
      if (browseStoreBtn) {
        browseStoreBtn.addEventListener('click', () => {
          closeGiftQuiz();
          const target = document.getElementById('bestsellers') || document.getElementById('collections');
          if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
          }
        });
      }

    }, 550);
  }

  // Navigation handlers
  if (btnQuizPrev) {
    btnQuizPrev.addEventListener('click', () => {
      if (currentQuizStep > 0) {
        renderQuizStep(currentQuizStep - 1);
      }
    });
  }

  if (btnQuizSkip) {
    btnQuizSkip.addEventListener('click', () => {
      showQuizResults();
    });
  }

  if (btnCloseQuiz) {
    btnCloseQuiz.addEventListener('click', closeGiftQuiz);
  }

  if (quizOverlay) {
    quizOverlay.addEventListener('click', (e) => {
      if (e.target === quizOverlay) {
        closeGiftQuiz();
      }
    });
  }

  // Keyboard close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && quizOverlay && quizOverlay.classList.contains('active')) {
      closeGiftQuiz();
    }
  });

  // Re-open Triggers
  if (btnHeaderQuiz) {
    btnHeaderQuiz.addEventListener('click', () => {
      openGiftQuiz();
    });
  }

  if (btnMobileQuiz) {
    btnMobileQuiz.addEventListener('click', () => {
      if (mobileDrawer) mobileDrawer.classList.remove('open');
      openGiftQuiz();
    });
  }

  if (floatingQuizTrigger) {
    floatingQuizTrigger.addEventListener('click', () => {
      openGiftQuiz();
    });
  }

  // Initialize Quiz
  renderQuizStep(0);
  const hasSeenQuiz = sessionStorage.getItem('gift_quiz_welcomed');
  const isHomePage = window.location.pathname.endsWith('index.html') || 
                     window.location.pathname === '/' || 
                     window.location.pathname === '' || 
                     !window.location.pathname.includes('.html');
  if (!hasSeenQuiz && isHomePage) {
    setTimeout(() => {
      openGiftQuiz();
    }, 1200);
  }

  // 16. PRODUCT DETAIL PAGE INTERACTIVE CONTROLLERS
  const pdpActiveImg = document.getElementById('pdp-active-image');
  const pdpThumbBtns = document.querySelectorAll('.thumb-btn');

  // 1. Gallery Switcher
  if (pdpActiveImg && pdpThumbBtns.length > 0) {
    pdpThumbBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        pdpThumbBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const newSrc = btn.getAttribute('data-img');
        if (newSrc) {
          pdpActiveImg.style.opacity = '0.4';
          setTimeout(() => {
            pdpActiveImg.src = newSrc;
            pdpActiveImg.style.opacity = '1';
          }, 150);
        }
      });
    });
  }

  // 2. Wood Finish & Velvet Swatches
  const woodSwatches = document.querySelectorAll('.wood-swatch');
  const selectedFinishLabel = document.getElementById('selected-finish-label');
  if (woodSwatches.length > 0) {
    woodSwatches.forEach(swatch => {
      swatch.addEventListener('click', () => {
        woodSwatches.forEach(s => {
          s.classList.remove('active');
          s.setAttribute('aria-checked', 'false');
        });
        swatch.classList.add('active');
        swatch.setAttribute('aria-checked', 'true');
        const finishName = swatch.getAttribute('data-finish') || 'Heritage Walnut';
        if (selectedFinishLabel) selectedFinishLabel.textContent = finishName;
      });
    });
  }

  const velvetSwatches = document.querySelectorAll('.velvet-swatch');
  const selectedVelvetLabel = document.getElementById('selected-velvet-label');
  if (velvetSwatches.length > 0) {
    velvetSwatches.forEach(swatch => {
      swatch.addEventListener('click', () => {
        velvetSwatches.forEach(s => {
          s.classList.remove('active');
          s.setAttribute('aria-checked', 'false');
        });
        swatch.classList.add('active');
        swatch.setAttribute('aria-checked', 'true');
        const velvetName = swatch.getAttribute('data-velvet') || 'Emerald Forest';
        if (selectedVelvetLabel) selectedVelvetLabel.textContent = velvetName;
      });
    });
  }

  // 3. Live Engraving Customizer Text & Font Preview
  const customNameInput = document.getElementById('custom-name-input');
  const customDateInput = document.getElementById('custom-date-input');
  const previewTextName = document.getElementById('preview-text-name');
  const previewTextDate = document.getElementById('preview-text-date');
  const fontRadioLabels = document.querySelectorAll('.font-radio-label');

  if (customNameInput && previewTextName) {
    customNameInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      previewTextName.textContent = val ? val : 'Your Name Here';
    });
  }

  if (customDateInput && previewTextDate) {
    customDateInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      previewTextDate.textContent = val ? val : 'Est. 2026';
    });
  }

  if (fontRadioLabels.length > 0 && previewTextName) {
    fontRadioLabels.forEach(label => {
      const radio = label.querySelector('input[type="radio"]');
      if (radio) {
        radio.addEventListener('change', () => {
          fontRadioLabels.forEach(l => l.classList.remove('active'));
          label.classList.add('active');
          
          previewTextName.classList.remove('font-serif-style', 'font-script-style', 'font-sans-style');
          if (radio.value === 'serif') previewTextName.classList.add('font-serif-style');
          else if (radio.value === 'script') previewTextName.classList.add('font-script-style');
          else if (radio.value === 'sans') previewTextName.classList.add('font-sans-style');
        });
      }
    });
  }

  // 4. Quantity Controls
  let pdpQty = 1;
  const basePrice = 49.00;
  const btnQtyMinus = document.getElementById('btn-qty-minus');
  const btnQtyPlus = document.getElementById('btn-qty-plus');
  const qtyVal = document.getElementById('qty-val');
  const btnAddPdpCart = document.getElementById('btn-add-pdp-cart');

  function updatePdpQtyDisplay() {
    if (qtyVal) qtyVal.textContent = pdpQty;
    if (btnAddPdpCart) {
      const total = (basePrice * pdpQty).toFixed(2);
      const span = btnAddPdpCart.querySelector('span');
      if (span) span.textContent = `Add Custom Box to Bag • $${total}`;
    }
  }

  if (btnQtyMinus) {
    btnQtyMinus.addEventListener('click', () => {
      if (pdpQty > 1) {
        pdpQty--;
        updatePdpQtyDisplay();
      }
    });
  }

  if (btnQtyPlus) {
    btnQtyPlus.addEventListener('click', () => {
      pdpQty++;
      updatePdpQtyDisplay();
    });
  }

  // 5. Add Custom Box to Cart
  if (btnAddPdpCart) {
    btnAddPdpCart.addEventListener('click', () => {
      const engravedName = customNameInput ? customNameInput.value.trim() : 'The Reynolds Family';
      const engravedDate = customDateInput ? customDateInput.value.trim() : 'Est. 2018';
      
      const itemTitle = `Engraved Keepsake Box ("${engravedName} • ${engravedDate}")`;
      const itemImg = pdpActiveImg ? pdpActiveImg.getAttribute('src') : 'images/personalized_box.jpg';
      
      for (let i = 0; i < pdpQty; i++) {
        addProductToCart(itemTitle, basePrice.toFixed(2), itemImg);
      }
      
      btnAddPdpCart.classList.add('added');
      const span = btnAddPdpCart.querySelector('span');
      if (span) span.textContent = `✓ Added ${pdpQty} to Shopping Bag!`;
      setTimeout(() => {
        btnAddPdpCart.classList.remove('added');
        updatePdpQtyDisplay();
      }, 2500);
    });
  }

  // 6. Wishlist Button on PDP
  const btnPdpWishlist = document.getElementById('btn-pdp-wishlist');
  if (btnPdpWishlist) {
    btnPdpWishlist.addEventListener('click', () => {
      const isActive = btnPdpWishlist.classList.toggle('active');
      if (isActive) {
        btnPdpWishlist.style.color = '#A72D32';
        btnPdpWishlist.style.borderColor = '#A72D32';
        showToast('Saved Engraved Keepsake Box to your Wishlist!');
      } else {
        btnPdpWishlist.style.color = '#333333';
        btnPdpWishlist.style.borderColor = '#E5E1D8';
        showToast('Removed Engraved Keepsake Box from Wishlist.');
      }
    });
  }

  // 7. Tabs Navigation
  const pdpTabBtns = document.querySelectorAll('.pdp-tab-btn');
  const pdpTabPanels = document.querySelectorAll('.pdp-tab-panel');
  if (pdpTabBtns.length > 0) {
    pdpTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        pdpTabBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        pdpTabPanels.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        const targetId = btn.getAttribute('data-tab');
        const targetPanel = document.getElementById(targetId);
        if (targetPanel) {
          targetPanel.classList.add('active');
        }
      });
    });
  }

});

