/**
 * Alex Mckee - Portfolio Client-Side JavaScript
 * Handles:
 * - Contact Form validation, submission to POST /api/contact, success/error feedback
 * - Mobile navigation menu toggle
 * - Active navigation states and smooth scroll
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initContactForm();
  highlightActiveNavLink();
  initProfilePhotoManager();
  initMediaGalleryLightbox();
});

/**
 * Mobile Navigation Menu Toggle
 */
function initMobileNav() {
  const toggleBtn = document.getElementById('navToggle');
  const navMenu = document.getElementById('siteNav');

  if (toggleBtn && navMenu) {
    toggleBtn.addEventListener('click', () => {
      const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      toggleBtn.setAttribute('aria-expanded', !isExpanded);
      navMenu.classList.toggle('is-open');
    });

    // Close menu when clicking outside on mobile
    document.addEventListener('click', (e) => {
      if (!navMenu.contains(e.target) && !toggleBtn.contains(e.target)) {
        navMenu.classList.remove('is-open');
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }
}

/**
 * Highlight the active link in the navigation based on current URL
 */
function highlightActiveNavLink() {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.nav-link');

  navLinks.forEach((link) => {
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath === '' && href === 'index.html')) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });
}

/**
 * Contact Form Validation & Submission
 */
function initContactForm() {
  const contactForm = document.getElementById('contactForm');
  if (!contactForm) return;

  const submitBtn = document.getElementById('submitBtn');
  const successBox = document.getElementById('formSuccess');
  const errorBox = document.getElementById('formError');
  const successText = document.getElementById('successText');
  const errorText = document.getElementById('errorText');

  // Input elements
  const firstNameInput = document.getElementById('firstName');
  const lastNameInput = document.getElementById('lastName');
  const emailInput = document.getElementById('email');
  const reasonSelect = document.getElementById('reason');
  const messageInput = document.getElementById('message');

  const inputs = [firstNameInput, lastNameInput, emailInput, reasonSelect, messageInput].filter(Boolean);

  // Clear validation styles on input
  inputs.forEach((input) => {
    input.addEventListener('input', () => {
      input.classList.remove('is-invalid');
      hideFeedback();
    });
  });

  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideFeedback();

    // 1. Client-Side Field Validation
    const firstName = firstNameInput?.value.trim() || '';
    const lastName = lastNameInput?.value.trim() || '';
    const email = emailInput?.value.trim() || '';
    const reason = reasonSelect?.value.trim() || '';
    const message = messageInput?.value.trim() || '';

    let hasError = false;
    let firstInvalidField = null;

    if (!firstName) {
      firstNameInput.classList.add('is-invalid');
      hasError = true;
      if (!firstInvalidField) firstInvalidField = firstNameInput;
    }

    if (!lastName) {
      lastNameInput.classList.add('is-invalid');
      hasError = true;
      if (!firstInvalidField) firstInvalidField = lastNameInput;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      emailInput.classList.add('is-invalid');
      hasError = true;
      if (!firstInvalidField) firstInvalidField = emailInput;
    }

    const validReasons = ['Comment', 'Question', 'Partnership', 'Opportunity', 'Other'];
    if (!reason || !validReasons.includes(reason)) {
      reasonSelect.classList.add('is-invalid');
      hasError = true;
      if (!firstInvalidField) firstInvalidField = reasonSelect;
    }

    if (!message) {
      messageInput.classList.add('is-invalid');
      hasError = true;
      if (!firstInvalidField) firstInvalidField = messageInput;
    }

    if (hasError) {
      showError('Please correct the highlighted fields above before submitting.');
      if (firstInvalidField) firstInvalidField.focus();
      return;
    }

    // 2. Prepare payload
    const payload = {
      firstName,
      lastName,
      email,
      reason,
      message
    };

    // 3. Submit to server endpoint POST /api/contact
    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting message...';
      }

      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.status === 201) {
        // Successful submission
        const timeFormatted = data.record?.submittedAt 
          ? new Date(data.record.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'just now';
        
        showSuccess(
          `Thank you, ${firstName}! Your message was successfully recorded (ID: ${data.record?.id?.slice(0, 8) || 'confirmed'}) at ${timeFormatted}.`
        );

        // Clear the form after a successful submission
        contactForm.reset();
        inputs.forEach(input => input.classList.remove('is-invalid'));
      } else if (response.status === 400) {
        // Validation failure
        showError(data.error || 'The submission was rejected. Please check all fields.');
      } else {
        // Server or storage failure (HTTP 500)
        showError(data.error || 'A storage error occurred while sending your message. Please try again later.');
      }
    } catch (networkError) {
      console.error('Fetch error:', networkError);
      showError('Unable to connect to the server. Please check your connection and try again.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Message';
      }
    }
  });

  function showSuccess(msg) {
    if (errorBox) errorBox.classList.remove('show');
    if (successBox && successText) {
      successText.textContent = msg;
      successBox.classList.add('show');
      successBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function showError(msg) {
    if (successBox) successBox.classList.remove('show');
    if (errorBox && errorText) {
      errorText.textContent = msg;
      errorBox.classList.add('show');
      errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function hideFeedback() {
    if (successBox) successBox.classList.remove('show');
    if (errorBox) errorBox.classList.remove('show');
  }
}

/**
 * Profile Photo Handler
 * Loads user photo if stored in localStorage or falls back to saved server asset
 */
function initProfilePhotoManager() {
  const photoImg = document.getElementById('studentPhoto');
  if (!photoImg) return;

  const savedPhoto = localStorage.getItem('alexMckeeProfilePhoto');
  if (savedPhoto) {
    photoImg.src = savedPhoto;
  }
}

/**
 * Media Gallery Lightbox & Expand Photo Feature
 * Allows clicking/pressing Enter on any photo box to expand in a full-screen
 * lightbox modal with smooth zoom, Next/Previous controls, keyboard navigation,
 * and backdrop dismissal.
 */
function initMediaGalleryLightbox() {
  const photoCards = Array.from(document.querySelectorAll('.photo-box-card'));
  const modal = document.getElementById('lightboxModal');
  const modalImg = document.getElementById('lightboxImage');
  const modalCaption = document.getElementById('lightboxCaption');
  const modalCounter = document.getElementById('lightboxCounter');
  const closeBtn = document.getElementById('lightboxCloseBtn');
  const backdrop = document.getElementById('lightboxBackdrop');
  const prevBtn = document.getElementById('lightboxPrevBtn');
  const nextBtn = document.getElementById('lightboxNextBtn');

  if (!photoCards.length || !modal || !modalImg) return;

  let currentIndex = 0;
  let lastActiveElement = null;

  const photos = photoCards.map((card, idx) => ({
    src: card.getAttribute('data-src') || (card.querySelector('img') && card.querySelector('img').src) || '',
    title: card.getAttribute('data-title') || 'Gallery Photo',
    cardElement: card,
    index: idx
  }));

  function openLightbox(index) {
    currentIndex = (index + photos.length) % photos.length;
    const photo = photos[currentIndex];
    lastActiveElement = document.activeElement;

    modalImg.src = photo.src;
    modalImg.alt = photo.title;
    if (modalCaption) modalCaption.textContent = photo.title;
    if (modalCounter) modalCounter.textContent = `Photo ${currentIndex + 1} of ${photos.length}`;

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (closeBtn) {
      setTimeout(() => closeBtn.focus(), 50);
    }
  }

  function closeLightbox() {
    if (!modal.classList.contains('active')) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
      lastActiveElement.focus();
    }
  }

  function showNextPhoto() {
    openLightbox(currentIndex + 1);
  }

  function showPrevPhoto() {
    openLightbox(currentIndex - 1);
  }

  // Attach card click & keyboard activation
  photoCards.forEach((card, idx) => {
    card.addEventListener('click', () => {
      openLightbox(idx);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(idx);
      }
    });
  });

  // Modal buttons
  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
  if (backdrop) backdrop.addEventListener('click', closeLightbox);
  if (nextBtn) nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showNextPhoto();
  });
  if (prevBtn) prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showPrevPhoto();
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('active')) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeLightbox();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      showNextPhoto();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      showPrevPhoto();
    }
  });
}
