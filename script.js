// Clean URLs: remove .html da barra de navegação para estética moderna
(function cleanUrl() {
  if (window.history && window.history.replaceState) {
    var p = window.location.pathname;
    if (p.endsWith('.html')) {
      var c = p.replace(/index\.html$/, '').replace(/\.html$/, '');
      if (!c) c = '/';
      window.history.replaceState(null, '', c + window.location.search + window.location.hash);
    }
  }
})();

const carousels = document.querySelectorAll('[data-carousel]');

/* Covers de fallback — usados apenas quando o CMS não tem imagem configurada */
const currentPortfolioCovers = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=360&q=70&auto=format&fit=crop&fm=webp',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=360&q=70&auto=format&fit=crop&fm=webp',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=360&q=70&auto=format&fit=crop&fm=webp',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=360&q=70&auto=format&fit=crop&fm=webp',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=360&q=70&auto=format&fit=crop&fm=webp',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=360&q=70&auto=format&fit=crop&fm=webp'
];

/* Vídeos de fallback para o portfólio */
const workingPortfolioVideos = [
  'https://res.cloudinary.com/demo/video/upload/q_auto,w_400/sea_turtle.mp4',
  'https://res.cloudinary.com/demo/video/upload/q_auto,w_400/finish_line.mp4',
  'https://res.cloudinary.com/demo/video/upload/q_auto,w_400/dog.mp4',
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  'https://res.cloudinary.com/demo/video/upload/q_auto,w_400/snow_deer.mp4',
  'https://res.cloudinary.com/demo/video/upload/q_auto,w_400/elephants.mp4'
];


/* === CONTROLES MINIMALISTAS DE VÍDEO (SEM CONTROLES NATIVOS) === */
const SOUND_ICON_MUTED = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;
const SOUND_ICON_UNMUTED = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
const PLAY_PULSE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg>`;
const PAUSE_PULSE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;

function showPlayPulse(container, isPlay) {
  if (!container) return;
  let pulse = container.querySelector('.video-play-pulse');
  if (!pulse) {
    pulse = document.createElement('div');
    pulse.className = 'video-play-pulse';
    container.appendChild(pulse);
  }
  pulse.innerHTML = isPlay ? PLAY_PULSE_ICON : PAUSE_PULSE_ICON;
  pulse.classList.remove('is-animating');
  void pulse.offsetWidth;
  pulse.classList.add('is-animating');
  clearTimeout(pulse._timer);
  pulse._timer = setTimeout(() => pulse.classList.remove('is-animating'), 380);
}

function attachSoundButton(container, video) {
  if (!container || !video || container.querySelector('.video-sound-control')) return;

  // Garante controles nativos do navegador removidos e som desligado por padrão
  video.controls = false;
  video.removeAttribute('controls');
  video.muted = true;
  video.playsInline = true;

  const soundCtrl = document.createElement('div');
  soundCtrl.className = 'video-sound-control';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'video-volume-slider';
  slider.min = '0';
  slider.max = '1';
  slider.step = '0.05';
  slider.value = String(video.volume || 0.8);
  slider.setAttribute('aria-label', 'Ajustar volume');
  slider.setAttribute('title', 'Ajustar volume');

  const soundBtn = document.createElement('button');
  soundBtn.type = 'button';
  soundBtn.className = 'video-sound-btn';
  soundBtn.setAttribute('aria-label', 'Ativar ou desativar áudio');
  soundBtn.setAttribute('title', 'Som ligado/desligado');
  soundBtn.innerHTML = `
    <span class="icon-muted">${SOUND_ICON_MUTED}</span>
    <span class="icon-unmuted">${SOUND_ICON_UNMUTED}</span>
  `;

  // Anexa soundBtn primeiro para ancorar no canto direito (flex row-reverse)
  soundCtrl.appendChild(soundBtn);
  soundCtrl.appendChild(slider);

  // Impede que clique, toque ou arrasto no controle acione o play/pause do card ou arraste a tela
  const stopProp = (e) => {
    e.stopPropagation();
  };
  soundCtrl.addEventListener('click', stopProp);
  soundCtrl.addEventListener('mousedown', stopProp);
  soundCtrl.addEventListener('pointerdown', stopProp);

  const syncControlState = () => {
    if (video.muted || video.volume === 0) {
      soundCtrl.classList.remove('is-unmuted');
      slider.value = '0';
    } else {
      soundCtrl.classList.add('is-unmuted');
      slider.value = String(video.volume);
    }
  };

  // Ajuste em tempo real ao mover o slider
  const onSliderChange = (e) => {
    e.stopPropagation();
    const val = parseFloat(slider.value);
    video.volume = val;
    if (val === 0) {
      video.muted = true;
      soundCtrl.classList.remove('is-unmuted');
    } else {
      video.muted = false;
      soundCtrl.classList.add('is-unmuted');
      // Muta todos os outros vídeos
      document.querySelectorAll('video').forEach(other => {
        if (other !== video) {
          other.muted = true;
          const otherCtrl = other.closest('.video-card, .hero-frame')?.querySelector('.video-sound-control');
          if (otherCtrl) otherCtrl.classList.remove('is-unmuted');
        }
      });
      if (video.paused) {
        video.play().catch(() => {});
      }
    }
  };

  slider.addEventListener('input', onSliderChange);
  slider.addEventListener('change', onSliderChange);

  // Clique no botão alterna entre mudo e volume ativo
  soundBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    video.muted = !video.muted;
    if (!video.muted) {
      if (video.volume === 0) {
        video.volume = 0.8;
      }
      slider.value = String(video.volume);
      soundCtrl.classList.add('is-unmuted');

      // Muta todos os outros vídeos
      document.querySelectorAll('video').forEach(other => {
        if (other !== video) {
          other.muted = true;
          const otherCtrl = other.closest('.video-card, .hero-frame')?.querySelector('.video-sound-control');
          if (otherCtrl) otherCtrl.classList.remove('is-unmuted');
        }
      });
      if (video.paused) {
        video.play().catch(() => {});
      }
    } else {
      soundCtrl.classList.remove('is-unmuted');
    }
  });

  video.addEventListener('volumechange', syncControlState);

  container.appendChild(soundCtrl);
}
window.attachSoundButton = attachSoundButton;
window.showPlayPulse = showPlayPulse;

document.querySelectorAll('.video-card').forEach((card, index) => {
  const video = card.querySelector('video');
  if (!video) return;

  // Garante controles nativos escondidos e som off por padrão
  video.controls = false;
  video.removeAttribute('controls');
  video.muted = true;
  video.playsInline = true;

  // Anexa botão de volume minimalista
  attachSoundButton(card, video);

  // Garante fonte funcional de vídeo caso aponte para URL legada
  const source = video.querySelector('source');
  const targetVideoUrl = workingPortfolioVideos[index % workingPortfolioVideos.length];
  if (!source || !source.src || source.src.includes('coverr-main')) {
    if (source) {
      source.src = targetVideoUrl;
    }
    video.src = targetVideoUrl;
    video.load();
  }

  // Se houver poster configurado no CMS, utiliza-o de imediato; caso contrário, preserva poster ou data-poster
  const cmsPoster = window.kmCMS?.data?.portfolioVideos?.[index]?.poster;
  if (cmsPoster && !cmsPoster.startsWith('idb:')) {
    video.poster = cmsPoster;
  } else if (!video.poster && !video.dataset.poster) {
    video.dataset.poster = currentPortfolioCovers[index % currentPortfolioCovers.length];
  }

  // Remove eventual badge legada de Play para não conflitar com player
  const existingBadge = card.querySelector('.video-play-badge');
  if (existingBadge) {
    existingBadge.remove();
  }

  // Sincroniza estado visual de reprodução
  video.addEventListener('play', () => card.classList.add('is-playing'));
  video.addEventListener('pause', () => card.classList.remove('is-playing'));
  video.addEventListener('ended', () => card.classList.remove('is-playing'));
});

// Lazy-loading de posters com IntersectionObserver para máxima velocidade inicial (LCP < 1.0s)
if ('IntersectionObserver' in window) {
  const videoPosterObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const video = entry.target;
        if (video.dataset.poster) {
          video.poster = video.dataset.poster;
          delete video.dataset.poster;
        }
        observer.unobserve(video);
      }
    });
  }, { rootMargin: '350px 0px' });

  document.querySelectorAll('video[data-poster]').forEach((video) => {
    videoPosterObserver.observe(video);
  });
} else {
  document.querySelectorAll('video[data-poster]').forEach((video) => {
    video.poster = video.dataset.poster;
    delete video.dataset.poster;
  });
}

// Inicialização do vídeo Hero com player customizado
const heroVideo = document.querySelector('.hero-frame video');
const heroFrame = document.querySelector('.hero-frame');
if (heroVideo && heroFrame) {
  heroVideo.controls = false;
  heroVideo.removeAttribute('controls');
  heroVideo.muted = true;
  heroVideo.playsInline = true;
  attachSoundButton(heroFrame, heroVideo);

  const heroSource = heroVideo.querySelector('source');
  if (!heroSource || !heroSource.src || heroSource.src.includes('coverr-main')) {
    const defHero = 'https://res.cloudinary.com/demo/video/upload/q_auto,w_600/sea_turtle.mp4';
    if (heroSource) heroSource.src = defHero;
    heroVideo.src = defHero;
    heroVideo.load();
    heroVideo.play().catch(() => {});
  }

  // Clique em qualquer canto do Hero dá play/pause
  heroFrame.style.cursor = 'pointer';
  heroFrame.addEventListener('click', (e) => {
    if (e.target.closest('.video-sound-control') || e.target.closest('.video-sound-btn') || e.target.closest('.admin-edit-media-btn')) return;
    if (heroVideo.paused) {
      document.querySelectorAll('.video-card video').forEach(v => { if (!v.paused) v.pause(); });
      heroVideo.play().then(() => showPlayPulse(heroFrame, true)).catch(() => {});
    } else {
      heroVideo.pause();
      showPlayPulse(heroFrame, false);
    }
  });
}

const latestInstagramPosts = [
  { image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80&auto=format&fit=crop', link: 'https://www.instagram.com/kemoraiso/reel/Dc4TsgNhvXy/', label: 'post recente / 01' },
  { image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&q=80&auto=format&fit=crop', link: 'https://www.instagram.com/kemoraiso/reel/DdFP3quBgB9/', label: 'post recente / 02' },
  { image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=80&auto=format&fit=crop', link: 'https://www.instagram.com/kemoraiso/reel/DctXke_BpJF/', label: 'post recente / 03' },
  { image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80&auto=format&fit=crop', link: 'https://www.instagram.com/kemoraiso/reel/Dbto7oNho3o/', label: 'post recente / 04' },
  { image: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&q=80&auto=format&fit=crop', link: 'https://www.instagram.com/kemoraiso/reel/Dav1BwnB8S4/', label: 'post recente / 05' },
  { image: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=600&q=80&auto=format&fit=crop', link: 'https://www.instagram.com/kemoraiso/reel/DcRrZvuh33B/', label: 'post recente / 06' },
  { image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&q=80&auto=format&fit=crop', link: 'https://www.instagram.com/kemoraiso/reel/DY65T1vu4bn/', label: 'post recente / 07' },
  { image: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&q=80&auto=format&fit=crop', link: 'https://www.instagram.com/kemoraiso/reel/Daan3KYuQgw/', label: 'post recente / 08' }
];

function setupDragToScroll(carousel, isVideo = false) {
  if (!carousel) return;

  let isDown = false;
  let startX = 0;
  let scrollStart = 0;
  let hasDragged = false;
  let wasDragged = false;

  // Previne arrasto nativo fantasma do navegador em imagens, vídeos e links
  carousel.querySelectorAll('img, video, a, article').forEach((el) => {
    el.setAttribute('draggable', 'false');
    el.addEventListener('dragstart', (e) => e.preventDefault());
  });

  carousel.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Apenas botão principal (esquerdo)
    if (e.target.closest('.video-sound-control') || e.target.closest('.video-sound-btn') || e.target.closest('.admin-edit-media-btn')) return;
    isDown = true;
    hasDragged = false;
    startX = e.pageX;
    scrollStart = carousel.scrollLeft;
    carousel.style.scrollBehavior = 'auto';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    const dx = e.pageX - startX;
    if (!hasDragged && Math.abs(dx) > 6) {
      hasDragged = true;
      wasDragged = true;
      carousel.classList.add('is-pointer-dragging');
    }
    if (hasDragged) {
      e.preventDefault();
      carousel.scrollLeft = scrollStart - dx;
    }
  });

  const stopDrag = () => {
    if (!isDown) return;
    isDown = false;
    carousel.style.scrollBehavior = '';
    carousel.classList.remove('is-pointer-dragging');
    if (hasDragged) {
      setTimeout(() => {
        wasDragged = false;
        hasDragged = false;
      }, 100);
    }
  };

  window.addEventListener('mouseup', stopDrag);
  window.addEventListener('blur', stopDrag);

  // Captura e cancela clique se houve arraste, ou dispara play/pause do vídeo em clique limpo
  carousel.addEventListener('click', (e) => {
    if (hasDragged || wasDragged) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      hasDragged = false;
      wasDragged = false;
      return;
    }

    if (isVideo) {
      const card = e.target.closest('.video-card');
      if (!card) return;

      // Clicou no controle de volume ou no botão de editar no admin: ignora play/pause do card
      if (e.target.closest('.video-sound-control') || e.target.closest('.video-sound-btn') || e.target.closest('.admin-edit-media-btn')) {
        return;
      }

      // Se for link de rede social externa (ex: Reel do Instagram ou TikTok), abre no clique
      if (card.dataset.externalUrl) {
        window.open(card.dataset.externalUrl, '_blank');
        return;
      }

      const video = card.querySelector('video');
      if (!video) return;

      if (video.dataset.poster) {
        video.poster = video.dataset.poster;
        delete video.dataset.poster;
      }

      if (video.paused) {
        // Pausa outros vídeos para evitar reprodução/áudio simultâneo
        document.querySelectorAll('video').forEach((other) => {
          if (other !== video && !other.paused) other.pause();
        });
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            showPlayPulse(card, true);
          }).catch((err) => {
            console.warn('Playback bloqueado por política de áudio, tentando muted:', err);
            video.muted = true;
            video.play().then(() => showPlayPulse(card, true)).catch((e) => console.error('Erro na reprodução do vídeo:', e));
          });
        }
      } else {
        video.pause();
        showPlayPulse(card, false);
      }
    }
  }, true);
}

const socialCarousel = document.querySelector('[data-social-carousel]');
if (socialCarousel) {
  const cmsInstagramPosts = window.kmCMS?.data?.instagramPosts;
  const postsToRender = (cmsInstagramPosts && Array.isArray(cmsInstagramPosts) && cmsInstagramPosts.length > 0)
    ? cmsInstagramPosts
    : latestInstagramPosts;

  socialCarousel.innerHTML = postsToRender.map((post, index) => `<a class="photo-card" href="${post.link || ''}" target="_blank" rel="noreferrer"><img src="${post.image || ''}" alt="${post.label || ''}" loading="lazy" onerror="this.onerror=null;this.src='${currentPortfolioCovers[index % currentPortfolioCovers.length]}'"><span>${post.label || ''} <b>&#8599;</b></span></a>`).join('');
  const photoShell = socialCarousel.closest('.photo-carousel-shell');
  const socialProgress = photoShell?.nextElementSibling?.querySelector('.progress-track i');
  let socialMaxScroll = 0;
  let socialStep = 400;

  const updateSocialDimensions = () => {
    socialMaxScroll = Math.max(0, socialCarousel.scrollWidth - socialCarousel.clientWidth);
    socialStep = Math.min(socialCarousel.clientWidth * 0.8, 500);
  };
  updateSocialDimensions();

  if (window.ResizeObserver) {
    new ResizeObserver(updateSocialDimensions).observe(socialCarousel);
  } else {
    window.addEventListener('resize', updateSocialDimensions, { passive: true });
  }
  window.addEventListener('load', updateSocialDimensions, { once: true });

  photoShell.querySelector('.prev')?.addEventListener('click', () => socialCarousel.scrollBy({ left: -socialStep, behavior: 'smooth' }));
  photoShell.querySelector('.next')?.addEventListener('click', () => socialCarousel.scrollBy({ left: socialStep, behavior: 'smooth' }));

  let socialScrollTicking = false;
  socialCarousel.addEventListener('scroll', () => {
    if (!socialScrollTicking) {
      requestAnimationFrame(() => {
        if (socialProgress) {
          const scale = socialMaxScroll > 0 ? Math.max(0.24, (socialCarousel.scrollLeft / socialMaxScroll) * 0.76 + 0.24) : 0.24;
          socialProgress.style.transform = `scaleX(${scale})`;
        }
        socialScrollTicking = false;
      });
      socialScrollTicking = true;
    }
  }, { passive: true });
  setupDragToScroll(socialCarousel, false);
}

carousels.forEach((carousel) => {
  const shell = carousel.closest('.carousel-shell');
  const previous = shell.querySelector('.prev');
  const next = shell.querySelector('.next');
  const categoryBlock = shell.closest('.category-block');
  const progress = categoryBlock ? categoryBlock.querySelector('.progress-track i') : null;

  let maxScroll = 0;
  let carouselStep = 400;

  const updateCarouselDimensions = () => {
    maxScroll = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
    carouselStep = Math.min(carousel.clientWidth * 0.8, 500);
  };
  updateCarouselDimensions();

  if (window.ResizeObserver) {
    new ResizeObserver(updateCarouselDimensions).observe(carousel);
  } else {
    window.addEventListener('resize', updateCarouselDimensions, { passive: true });
  }
  window.addEventListener('load', updateCarouselDimensions, { once: true });

  previous.addEventListener('click', () => carousel.scrollBy({ left: -carouselStep, behavior: 'smooth' }));
  next.addEventListener('click', () => carousel.scrollBy({ left: carouselStep, behavior: 'smooth' }));

  let carouselScrollTicking = false;
  carousel.addEventListener('scroll', () => {
    if (!carouselScrollTicking) {
      requestAnimationFrame(() => {
        if (progress) {
          const scale = maxScroll > 0 ? Math.max(0.24, (carousel.scrollLeft / maxScroll) * 0.76 + 0.24) : 0.24;
          progress.style.transform = `scaleX(${scale})`;
        }
        carouselScrollTicking = false;
      });
      carouselScrollTicking = true;
    }
  }, { passive: true });
  setupDragToScroll(carousel, true);
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

const sections = document.querySelectorAll('main section[id]');
const navLinks = document.querySelectorAll('.nav-link');
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((link) => link.classList.toggle('is-active', link.getAttribute('href') === `#${entry.target.id}`));
  });
}, { rootMargin: '-40% 0px -50% 0px' });
sections.forEach((section) => sectionObserver.observe(section));

// Pause videos that leave the viewport to keep the page light on mobile.
const videoObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) return;
    if (!entry.target.paused) entry.target.pause();
  });
}, { threshold: 0.15 });
document.querySelectorAll('video').forEach((video) => videoObserver.observe(video));

const filterBar = document.querySelector('.filter-bar');
const filterButtons = document.querySelectorAll('[data-filter]');
const categoryBlocks = document.querySelectorAll('[data-category]');
let isManualFilterScroll = false;
let filterScrollTimeout = null;

/**
 * Rola horizontalmente APENAS a barra de filtros para centralizar o botão ativo.
 * NUNCA toca na rolagem vertical da página (window.scrollY), eliminando qualquer salto indesejado.
 */
function scrollFilterBarToActive(button) {
  if (!filterBar || !button) return;
  if (filterBar.scrollWidth <= filterBar.clientWidth) return;

  const targetLeft = button.offsetLeft - (filterBar.clientWidth / 2) + (button.offsetWidth / 2);
  filterBar.scrollTo({
    left: Math.max(0, targetLeft),
    behavior: 'smooth'
  });
}

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const selectedFilter = button.dataset.filter;
    isManualFilterScroll = true;
    if (filterScrollTimeout) clearTimeout(filterScrollTimeout);

    // 1. Atualiza estado visual dos botões
    filterButtons.forEach((item) => {
      const isActive = item === button;
      item.classList.toggle('is-active', isActive);
      item.setAttribute('aria-pressed', String(isActive));
      item.setAttribute('aria-current', isActive ? 'true' : 'false');
    });

    // 2. Filtra as seções de cases (exibe/oculta)
    categoryBlocks.forEach((category) => {
      const shouldShow = selectedFilter === 'todos' || category.dataset.category === selectedFilter;
      category.classList.toggle('is-hidden', !shouldShow);
    });

    // 3. Centraliza o botão clicado na barra de filtros horizontalmente (especialmente no mobile)
    scrollFilterBarToActive(button);

    // 4. Rola a página suavemente para o topo do case selecionado,
    //    evitando que a redução de altura da página jogue o usuário no fim dela.
    requestAnimationFrame(() => {
      const targetBlock = selectedFilter === 'todos'
        ? document.querySelector('#trabalhos')
        : document.querySelector(`[data-category="${selectedFilter}"]`);

      if (targetBlock) {
        const filterBarHeight = filterBar ? filterBar.offsetHeight + 24 : 75;
        const targetTop = targetBlock.getBoundingClientRect().top + window.pageYOffset - filterBarHeight;

        window.scrollTo({
          top: Math.max(0, targetTop),
          behavior: 'smooth'
        });
      }

      filterScrollTimeout = setTimeout(() => {
        isManualFilterScroll = false;
      }, 700);
    });
  });
});

const categoryObserver = new IntersectionObserver((entries) => {
  // Não dispara durante o scroll automático do clique de filtro
  if (isManualFilterScroll) return;

  // Se houver filtro ativo (algum bloco oculto), não altera os botões com base no scroll
  const isAnyHidden = Array.from(categoryBlocks).some((block) => block.classList.contains('is-hidden'));
  if (isAnyHidden) return;

  const visibleCategory = entries
    .filter((entry) => entry.isIntersecting && !entry.target.classList.contains('is-hidden'))
    .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];
  if (!visibleCategory) return;

  const activeButton = document.querySelector(`[data-filter="${visibleCategory.target.dataset.category}"]`);
  if (!activeButton) return;
  filterButtons.forEach((button) => {
    const isActive = button === activeButton;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
    button.setAttribute('aria-current', isActive ? 'true' : 'false');
  });
  scrollFilterBarToActive(activeButton);
}, { rootMargin: '-20% 0px -50% 0px', threshold: [0.1, 0.25, 0.5] });
categoryBlocks.forEach((category) => categoryObserver.observe(category));

/* === HEADER FIXO COM CONTROLE DE VISIBILIDADE (ZERO FORCED REFLOW) =
   - Utiliza IntersectionObserver assíncrono para eliminar 100% de reflows forçados (layout thrashing).
   - Some quando o menu de filtros (.filter-bar) estiver fixado no topo.
   - Some quando chegar na última dobra da página (seção #contato e rodapé).
   ============================================================= */
const siteHeader = document.querySelector('.site-header');
const portfolioSection = document.querySelector('#trabalhos');
const portfolioHeading = document.querySelector('#trabalhos .section-heading');
const contactSection = document.querySelector('#contato');

let isHeadingPastTop = false;
let isPortfolioInView = false;
let isLastFold = false;

function syncHeaderVisibility() {
  if (!siteHeader) return;
  const isFilterSticky = isHeadingPastTop && isPortfolioInView;
  const shouldHideHeader = isFilterSticky || isLastFold;
  siteHeader.classList.toggle('is-hidden-header', shouldHideHeader);
  siteHeader.classList.toggle('header-hidden', shouldHideHeader);
}

// 1. Observador do cabeçalho do portfólio (detecta quando o usuário rolou além do título e chegou nos filtros)
if (portfolioHeading) {
  const headingObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      isHeadingPastTop = !entry.isIntersecting && entry.boundingClientRect.top < 70;
      syncHeaderVisibility();
    });
  }, { rootMargin: '-70px 0px 0px 0px', threshold: 0 });
  headingObserver.observe(portfolioHeading);
}

// 2. Observador da seção de portfólio como um todo (detecta quando a vitrine de vídeos está na tela)
if (portfolioSection) {
  const portfolioObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      isPortfolioInView = entry.isIntersecting;
      syncHeaderVisibility();
    });
  }, { rootMargin: '-70px 0px 0px 0px', threshold: 0 });
  portfolioObserver.observe(portfolioSection);
}

// 3. Observador da última dobra (seção #contato e rodapé)
if (contactSection) {
  const contactObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      isLastFold = entry.isIntersecting;
      syncHeaderVisibility();
    });
  }, { rootMargin: '0px 0px -15% 0px', threshold: 0 });
  contactObserver.observe(contactSection);
}

/* === FORMULÁRIO — Web3Forms ====================================
   Os e-mails chegam direto no Gmail da Kelly via Web3Forms.
   ============================================================= */

/**
 * Envia um formulário para a API Web3Forms de forma assíncrona.
 * @param {HTMLFormElement} form - Formulário a ser enviado
 * @param {string} successHTML  - HTML a ser exibido após envio bem-sucedido
 */
async function submitWeb3Form(form, successHTML) {
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.innerHTML;

  submitBtn.innerHTML = 'Enviando… <span aria-hidden="true">↻</span>';
  submitBtn.disabled = true;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const result = await response.json();

    if (result.success) {
      form.innerHTML = successHTML;
    } else {
      submitBtn.innerHTML = 'Tentar novamente <span aria-hidden="true">↻</span>';
      submitBtn.disabled = false;
      console.warn('Web3Forms error:', result);
    }
  } catch (error) {
    clearTimeout(timeoutId);
    submitBtn.innerHTML = originalBtnText;
    submitBtn.disabled = false;
    if (error.name !== 'AbortError') {
      console.error('Erro ao enviar:', error);
    }
  }
}

const briefingForm = document.querySelector('.briefing-form');
if (briefingForm) {
  briefingForm.addEventListener('submit', (event) => {
    event.preventDefault();
    submitWeb3Form(briefingForm, `
      <div class="form-success">
        <span class="form-check">✓</span>
        <p>Briefing recebido!</p>
        <small>Já caiu na minha caixa de entrada. Em breve entro em contato.<br>Prefere ir direto? <a href="mailto:marketing.kellymorais@gmail.com">marketing.kellymorais@gmail.com</a></small>
      </div>
    `);
  });
}

/* === HAMBURGER MENU =========================================== */
const navToggle = document.querySelector('.nav-toggle');
const mobileNav = document.querySelector('.mobile-nav');
if (navToggle && mobileNav) {
  const openMenu = () => {
    mobileNav.classList.add('is-open');
    navToggle.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    navToggle.setAttribute('aria-expanded', 'true');
  };
  const closeMenu = () => {
    mobileNav.classList.remove('is-open');
    navToggle.classList.remove('is-open');
    document.body.style.overflow = '';
    navToggle.setAttribute('aria-expanded', 'false');
  };
  navToggle.addEventListener('click', openMenu);
  mobileNav.querySelector('.mobile-nav-close').addEventListener('click', closeMenu);
  mobileNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
}

/* === SKELETON LOADER — marcar card como carregado ============= */
document.querySelectorAll('.photo-card img').forEach((img) => {
  if (img.complete) {
    img.closest('.photo-card')?.classList.add('loaded');
  } else {
    img.addEventListener('load', () => img.closest('.photo-card')?.classList.add('loaded'));
  }
});

/* === POPUPS DE CONTATO (LINKTREE & BRIEFING) =================== */
const modalLinktree = document.getElementById('modal-linktree');
const modalEmailForm = document.getElementById('modal-email-form');
const btnOpenEmailModal = document.getElementById('btn-open-email-modal');
const btnBackToLinktree = document.getElementById('btn-back-to-linktree');
const contactTriggers = document.querySelectorAll('[data-open-contact]');

const openModal = (modal) => {
  if (!modal) return;
  modal.style.display = 'grid';
  requestAnimationFrame(() => {
    modal.classList.add('is-active');
  });
  modal.setAttribute('aria-hidden', 'false');
  modal.removeAttribute('inert');
  document.body.style.overflow = 'hidden';
};

const closeModal = (modal) => {
  if (!modal) return;
  modal.classList.remove('is-active');
  modal.setAttribute('aria-hidden', 'true');
  modal.setAttribute('inert', '');
  setTimeout(() => {
    if (!modal.classList.contains('is-active')) {
      modal.style.display = 'none';
    }
  }, 260);
  if (!document.querySelector('.contact-modal.is-active')) {
    document.body.style.overflow = '';
  }
};

const closeAllModals = () => {
  document.querySelectorAll('.contact-modal').forEach((modal) => closeModal(modal));
};

// Abrir popup Linktree ao clicar em qualquer CTA configurado
contactTriggers.forEach((trigger) => {
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    closeAllModals();
    openModal(modalLinktree);
  });
});

// Abrir diretamente o popup de e-mail / formulário de briefing
document.querySelectorAll('[data-open-email-modal]').forEach((trigger) => {
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    closeAllModals();
    openModal(modalEmailForm);
  });
});

// Transição do Linktree para o Formulário de E-mail
if (btnOpenEmailModal) {
  btnOpenEmailModal.addEventListener('click', () => {
    closeModal(modalLinktree);
    openModal(modalEmailForm);
  });
}

// Botão voltar do Formulário para o Linktree
if (btnBackToLinktree) {
  btnBackToLinktree.addEventListener('click', () => {
    closeModal(modalEmailForm);
    openModal(modalLinktree);
  });
}

// Fechar modais ao clicar em backdrop ou botão de fechar
document.querySelectorAll('[data-close-modal]').forEach((elem) => {
  elem.addEventListener('click', () => closeAllModals());
});

// Fechar com a tecla Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllModals();
});

// Envio assíncrono do formulário dentro do popup modal
const modalBriefingForm = document.querySelector('.modal-briefing-form');
if (modalBriefingForm) {
  modalBriefingForm.addEventListener('submit', (event) => {
    event.preventDefault();
    submitWeb3Form(modalBriefingForm, `
      <div class="form-success" style="padding: 20px 0; text-align: center;">
        <span class="form-check" style="margin: 0 auto 10px;">✓</span>
        <p style="font-size: 18px;">Briefing recebido!</p>
        <small style="display: block; margin-top: 8px;">Chegou direto na caixa de entrada da Kelly.<br>Em breve ela responderá sua proposta!</small>
      </div>
    `);
  });
}
