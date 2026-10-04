/**
 * KMORAIS - CMS Content Engine
 * Gerencia o carregamento e aplicação do conteúdo dinâmico no site principal e no painel admin.
 */

const KM_CMS_STORAGE_KEY = 'kmorais_cms_content_v1';
const KM_CMS_SYNC_KEY = 'kmorais_cms_updated_at';

function normalizeVideoUrl(url) {
  if (!url || typeof url !== 'string') return '';
  url = url.trim();

  // 1. Google Drive (converte link de compartilhamento para streaming direto)
  const driveMatch = url.match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+))/);
  if (driveMatch) {
    const fileId = driveMatch[1] || driveMatch[2];
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  // 2. Dropbox (dl=0 -> raw=1 para streaming direto)
  if (url.includes('dropbox.com') && url.includes('dl=0')) {
    return url.replace('dl=0', 'raw=1');
  }

  return url;
}

/**
 * Normaliza e otimiza automaticamente URLs de imagens (Unsplash, Cloudinary, etc.)
 * para garantir sempre entrega em WebP e parâmetros de alta performance.
 */
function normalizeImageUrl(url, maxW) {
  if (!url || typeof url !== 'string') return '';
  url = url.trim();

  // Garante que referências locais na pasta media usem a versão compactada .webp
  if (url.includes('/media/') && (url.endsWith('.jpeg') || url.endsWith('.jpg'))) {
    url = url.replace(/\.(jpeg|jpg)$/i, '.webp');
  }

  // Mantém blobs locais, identificadores IDB e Data URLs WebP
  if (url.startsWith('data:image/webp') || url.startsWith('blob:') || url.startsWith('idb:')) {
    return url;
  }

  // 1. Unsplash: auto-healing de fotos antigas/removidas e força WebP/compressão
  if (url.includes('images.unsplash.com')) {
    if (url.includes('photo-1512290900672-1f0233320ef4')) {
      url = url.replace('photo-1512290900672-1f0233320ef4', 'photo-1527799820374-dcf8d9d4a388');
    }
    try {
      const u = new URL(url);
      u.searchParams.set('auto', 'format,compress');
      u.searchParams.set('fit', 'crop');
      u.searchParams.set('fm', 'webp');
      const curW = Number(u.searchParams.get('w'));
      if (maxW && (!curW || curW > maxW)) {
        u.searchParams.set('w', String(maxW));
      } else if (!curW || curW > 300) {
        u.searchParams.set('w', '300');
      }
      const curQ = Number(u.searchParams.get('q'));
      if (!curQ || curQ > 45) {
        u.searchParams.set('q', '45');
      }
      return u.toString();
    } catch (_) {
      return url;
    }
  }

  // 2. Cloudinary: injeta flags f_auto,q_auto
  if (url.includes('res.cloudinary.com') && url.includes('/image/upload/')) {
    if (!url.includes('f_auto') && !url.includes('f_webp')) {
      return url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
    }
  }

  return url;
}

// Sanitizador anti-XSS para renderização segura de textos e tags básicas do CMS
function sanitizeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<\s*(?:script|iframe|object|embed|applet|meta|link|style)[^>]*>[\s\S]*?<\s*\/\s*(?:script|iframe|object|embed|applet|meta|link|style)\s*>/gi, '')
    .replace(/<\s*(?:script|iframe|object|embed|applet|meta|link|style)[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

// Função utilitária de Deep Merge para preservar propriedades aninhadas e padrões
function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  const output = Object.assign({}, target);
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = output[key];
    if (Array.isArray(srcVal)) {
      output[key] = srcVal.slice();
    } else if (srcVal && typeof srcVal === 'object' && !Array.isArray(srcVal)) {
      output[key] = deepMerge(tgtVal && typeof tgtVal === 'object' ? tgtVal : {}, srcVal);
    } else if (srcVal !== undefined) {
      output[key] = srcVal;
    }
  }
  return output;
}

// Conteúdo padrão extraído do design original
const defaultCMSContent = {
  hero: {
    eyebrow: "Kelly Morais · creator + marketing",
    title: "Conteúdo que<br><em>parece conversa</em><br>e gera ação.",
    text: "UGC com a autenticidade de uma mãe real, a visão de quem fez marketing de e-commerce e o roteiro que uma campanha precisa para performar.",
    sticker: "a vibe que<br><strong>para o scroll</strong>",
    video: "",
    poster: "https://kellymorais.com.br/media/hero_poster.webp"
  },
  brandsTitle: "Grandes marcas <em>confiam.</em>",
  brandsList: [
    { name: "Dove", image: "" },
    { name: "Fox Cycles", image: "" },
    { name: "Seda", image: "" },
    { name: "Kibon", image: "" },
    { name: "Omo", image: "" },
    { name: "Avon", image: "" },
    { name: "Kopenhagen", image: "" },
    { name: "Cif", image: "" },
    { name: "Pantene", image: "" },
    { name: "Eudora", image: "" },
    { name: "Mercado Livre", image: "" },
    { name: "Sensodyne", image: "" },
    { name: "Secret", image: "" },
    { name: "Upseller ERP", image: "" }
  ],
  portfolioTitle: "Cases que<br><em>fazem vender.</em>",
  portfolioIntro: "Do roteiro ao video final, cada entrega nasce alinhada ao objetivo da marca: conectar, explicar ou converter.",
  portfolioVideos: [],
  servicesTitle: "Conteudo para<br><em>cada objetivo.</em>",
  servicesList: [
    { title: "Videos para Ads", text: "Roteiro alinhado ao objetivo da campanha, com gancho, prova e CTA." },
    { title: "Marketplace", text: "Videos curtos, diretos e demonstrativos para apresentar produtos e vender mais." },
    { title: "Live Shop", text: "Conteudo nativo e demonstrativo para aproximar produto, creator e compra." },
    { title: "Pacote para agencia", text: "Roteiros, variacoes de hook, gravacao e entregas organizadas para seus clientes." }
  ],
  about: {
    eyebrow: "quem está por trás",
    title: "A amiga que<br>seu público <em>estava procurando.</em>",
    bio: "Tenho 26 anos, moro em São Paulo e sou formada em Marketing. Sou mãe, trabalho no marketing de um e-commerce e crio conteúdo com uma linguagem leve, real e sem performar.",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&q=65&auto=format&fit=crop&fm=webp"
  },
  contact: {
    title: "Tem uma ideia?<br><em>Vamos tirar do papel.</em>",
    email: "marketing.kellymorais@gmail.com",
    whatsapp: "+55 11 95636-7834",
    whatsappLink: "https://wa.me/5511956367834"
  },
  realCases: [
    {
      cover: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=450&q=65&auto=format&fit=crop&fm=webp",
      link: "https://www.instagram.com/kemoraiso/reel/Dc4TsgNhvXy/",
      tag: "01 / Instagram Reel",
      title: "Conteudo com cara de rotina",
      desc: "Para aproximar produto e audiencia sem perder naturalidade."
    },
    {
      cover: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=450&q=65&auto=format&fit=crop&fm=webp",
      link: "https://www.instagram.com/kemoraiso/reel/DdFP3quBgB9/",
      tag: "02 / Instagram Reel",
      title: "Creator + CLT",
      desc: "A vida real como contexto para uma historia que conecta."
    },
    {
      cover: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=450&q=65&auto=format&fit=crop&fm=webp",
      link: "https://www.instagram.com/foxcyclesoficial/reel/DUB0JGkkkR_/",
      tag: "03 / Collab de marca",
      title: "Conteudo para negocio real",
      desc: "Quando a creator entra na conversa oficial da marca."
    },
    {
      cover: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=450&q=65&auto=format&fit=crop&fm=webp",
      link: "https://www.tiktok.com/@kellymoraiso",
      tag: "04 / TikTok",
      title: "Rotina, maternidade e dicas",
      desc: "31K pessoas acompanhando conteudo que informa e acolhe."
    }
  ],
  instagramPosts: [
    { image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=60&auto=format&fit=crop&fm=webp', link: 'https://www.instagram.com/kemoraiso/reel/Dc4TsgNhvXy/', label: 'post recente / 01' },
    { image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=60&auto=format&fit=crop&fm=webp', link: 'https://www.instagram.com/kemoraiso/reel/DdFP3quBgB9/', label: 'post recente / 02' },
    { image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=60&auto=format&fit=crop&fm=webp', link: 'https://www.instagram.com/kemoraiso/reel/DctXke_BpJF/', label: 'post recente / 03' },
    { image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=60&auto=format&fit=crop&fm=webp', link: 'https://www.instagram.com/kemoraiso/reel/Dbto7oNho3o/', label: 'post recente / 04' },
    { image: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&q=60&auto=format&fit=crop&fm=webp', link: 'https://www.instagram.com/kemoraiso/reel/Dav1BwnB8S4/', label: 'post recente / 05' },
    { image: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&q=60&auto=format&fit=crop&fm=webp', link: 'https://www.instagram.com/kemoraiso/reel/DcRrZvuh33B/', label: 'post recente / 06' },
    { image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=60&auto=format&fit=crop&fm=webp', link: 'https://www.instagram.com/kemoraiso/reel/DY65T1vu4bn/', label: 'post recente / 07' },
    { image: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&q=60&auto=format&fit=crop&fm=webp', link: 'https://www.instagram.com/kemoraiso/reel/Daan3KYuQgw/', label: 'post recente / 08' }
  ]
};

class KMMediaStore {
  constructor() {
    this.dbPromise = this.initDB();
    this.blobUrlCache = new Map();
  }

  initDB() {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        resolve(null);
        return;
      }

      let settled = false;
      const safeResolve = (res) => {
        if (!settled) {
          settled = true;
          resolve(res);
        }
      };

      // Timeout de segurança: se o IndexedDB demorar ou estiver bloqueado, nunca trava a página
      setTimeout(() => safeResolve(null), 1200);

      try {
        const req = indexedDB.open('kmorais_media_store', 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('media')) {
            db.createObjectStore('media', { keyPath: 'id' });
          }
        };
        req.onsuccess = () => safeResolve(req.result);
        req.onerror = (err) => {
          console.warn('KMMediaStore: IndexedDB init error', err);
          safeResolve(null);
        };
        req.onblocked = () => {
          console.warn('KMMediaStore: IndexedDB blocked');
          safeResolve(null);
        };
      } catch (err) {
        console.warn('KMMediaStore: IndexedDB open exception', err);
        safeResolve(null);
      }
    });
  }

  async saveMedia(id, blobOrFile, mimeType) {
    const db = await this.dbPromise;
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('media', 'readwrite');
        const store = tx.objectStore('media');
        store.put({ id, data: blobOrFile, type: mimeType, updated: Date.now() });
        tx.oncomplete = () => resolve(id);
        tx.onerror = (err) => {
          console.error('KMMediaStore save error:', err);
          resolve(null);
        };
      } catch (err) {
        console.error('KMMediaStore tx error:', err);
        resolve(null);
      }
    });
  }

  async getMedia(id) {
    const db = await this.dbPromise;
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('media', 'readonly');
        const store = tx.objectStore('media');
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
  }

  async deleteMedia(id) {
    if (!id || typeof id !== 'string') return false;
    const db = await this.dbPromise;
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('media', 'readwrite');
        const store = tx.objectStore('media');
        store.delete(id);
        tx.oncomplete = () => {
          this.blobUrlCache.delete(id);
          resolve(true);
        };
        tx.onerror = () => resolve(false);
      } catch (err) {
        resolve(false);
      }
    });
  }

  async cleanupOrphans(activeIds = []) {
    const db = await this.dbPromise;
    if (!db) return 0;
    const activeSet = new Set(activeIds.filter(id => id && typeof id === 'string' && id.startsWith('idb:')));
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('media', 'readwrite');
        const store = tx.objectStore('media');
        const req = store.getAllKeys();
        req.onsuccess = () => {
          const allKeys = req.result || [];
          let removedCount = 0;
          for (const key of allKeys) {
            if (!activeSet.has(key)) {
              store.delete(key);
              this.blobUrlCache.delete(key);
              removedCount++;
            }
          }
          tx.oncomplete = () => {
            if (removedCount > 0) {
              console.log(`KMMediaStore: limpos ${removedCount} arquivo(s) antigos/órfãos do banco.`);
            }
            resolve(removedCount);
          };
          tx.onerror = () => resolve(0);
        };
        req.onerror = () => resolve(0);
      } catch (err) {
        resolve(0);
      }
    });
  }

  async resolveUrl(urlOrId) {
    if (!urlOrId) return '';
    if (typeof urlOrId === 'string' && urlOrId.startsWith('idb:')) {
      if (this.blobUrlCache.has(urlOrId)) {
        return this.blobUrlCache.get(urlOrId);
      }
      try {
        const blob = await Promise.race([
          this.getMedia(urlOrId),
          new Promise((r) => setTimeout(() => r(null), 2000))
        ]);
        if (blob) {
          const blobUrl = URL.createObjectURL(blob);
          this.blobUrlCache.set(urlOrId, blobUrl);
          return blobUrl;
        }
      } catch (err) {
        console.warn('KMMediaStore: erro ao resolver idb URL', err);
      }
      return '';
    }
    return urlOrId;
  }
}

const kmMediaStore = new KMMediaStore();
if (typeof window !== 'undefined') {
  window.kmMediaStore = kmMediaStore;
}

class KMCMS {
  constructor() {
    this.data = this.loadLocalContent();
  }

  loadLocalContent() {
    try {
      let saved = localStorage.getItem(KM_CMS_STORAGE_KEY);
      if (saved) {
        if (saved.includes('photo-1512290900672-1f0233320ef4')) {
          saved = saved.replace(/photo-1512290900672-1f0233320ef4/g, 'photo-1527799820374-dcf8d9d4a388');
          localStorage.setItem(KM_CMS_STORAGE_KEY, saved);
        }
        const parsed = JSON.parse(saved);
        return deepMerge(defaultCMSContent, parsed);
      }
    } catch (e) {
      console.warn('CMS: Falha ao carregar conteúdo local', e);
    }
    return deepMerge({}, defaultCMSContent);
  }

  saveContent(newData) {
    try {
      this.data = deepMerge(this.data, newData);
      localStorage.setItem(KM_CMS_STORAGE_KEY, JSON.stringify(this.data));
      localStorage.setItem(KM_CMS_SYNC_KEY, String(Date.now()));

      // 1. Sincroniza via BroadcastChannel para outras abas
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const channel = new BroadcastChannel('km_cms_channel');
          channel.postMessage({ type: 'CONTENT_UPDATED', data: this.data });
        } catch (err) {
          console.warn('CMS: BroadcastChannel falhou', err);
        }
      }

      // 2. Dispara evento customizado na própria janela
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kmCMSUpdated', { detail: this.data }));
      }

      return true;
    } catch (e) {
      console.error('CMS: Erro ao salvar conteúdo', e);
      return false;
    }
  }

  reloadAndApply() {
    this.data = this.loadLocalContent();
    return this.applyToPage();
  }

  async fetchPublishedContent() {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return null;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`content.json?_t=${Date.now()}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      const published = await res.json();
      if (!published || typeof published !== 'object') return null;

      const localSaved = localStorage.getItem(KM_CMS_STORAGE_KEY);
      const localUpdatedAt = localStorage.getItem(KM_CMS_SYNC_KEY);

      const publishedTimestamp = published.updatedAt ? new Date(published.updatedAt).getTime() : 0;
      const localTimestamp = localUpdatedAt ? Number(localUpdatedAt) : 0;

      // Guarda de 15 segundos: se o localStorage foi salvo nos últimos 15s,
      // o content.json do servidor pode ainda estar em cache/CDN desatualizado.
      // Não sobrescrever para evitar FOIC (flash da imagem antiga após salvar).
      const gracePeriodMs = 15000;
      const localIsFresh = localTimestamp && (Date.now() - localTimestamp) < gracePeriodMs;
      if (localIsFresh) {
        console.log('[CMS] Dados locais recém-salvos (' + Math.round((Date.now() - localTimestamp) / 1000) + 's). Ignorando content.json para evitar FOIC.');
        return published;
      }

      // Se os dados publicados no GitHub forem diferentes do que está em cache (outro aparelho salvou):
      if (!localSaved || (publishedTimestamp && publishedTimestamp !== localTimestamp)) {
        this.data = deepMerge(defaultCMSContent, published);
        localStorage.setItem(KM_CMS_STORAGE_KEY, JSON.stringify(this.data));
        if (publishedTimestamp) {
          localStorage.setItem(KM_CMS_SYNC_KEY, String(publishedTimestamp));
        }
        // Remove o escudo FOIC antes de aplicar o conteúdo remoto
        document.getElementById('km-foic-shield')?.remove();
        await this.applyToPage();
      }
      return published;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name !== 'AbortError') {
        console.warn('CMS: Falha ao buscar conteúdo publicado', err);
      }
      return null;
    }
  }


  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  }

  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && typeof parsed === 'object') {
        this.saveContent(parsed);
        this.applyToPage();
        return true;
      }
    } catch (err) {
      console.error('Falha ao importar JSON:', err);
    }
    return false;
  }

  async applyToPage() {
    const data = this.data;
    if (!data) return;

    // =========================================================================
    // FASE 1: APLICAÇÃO SÍNCRONA IMEDIATA (TEXTOS E MÍDIAS DIRETAS SEM AWAIT)
    // Executa em < 1ms: elimina 100% do flicker de imagens e fontes antes da tela pintar
    // =========================================================================

    // 1. Hero Texts & Mídias Diretas
    try {
      const heroEyebrow = document.querySelector('.hero-copy .eyebrow');
      if (heroEyebrow && data.hero?.eyebrow) {
        heroEyebrow.innerHTML = `<span class="eyebrow-line"></span> ${sanitizeHtml(data.hero.eyebrow)}`;
      }

      const heroTitle = document.querySelector('#hero-title');
      if (heroTitle && data.hero?.title) {
        heroTitle.innerHTML = sanitizeHtml(data.hero.title);
      }

      const heroText = document.querySelector('.hero-text');
      if (heroText && data.hero?.text) {
        heroText.innerHTML = sanitizeHtml(data.hero.text);
      }

      const heroSticker = document.querySelector('.hero-sticker');
      if (heroSticker && data.hero?.sticker) {
        heroSticker.innerHTML = sanitizeHtml(data.hero.sticker);
      }

      const heroVideo = document.querySelector('.hero-frame video');
      const heroFrame = document.querySelector('.hero-frame');
      if (heroVideo) {
        heroVideo.controls = false;
        heroVideo.removeAttribute('controls');
        heroVideo.muted = true;
        if (typeof window !== 'undefined' && window.attachSoundButton && heroFrame) {
          window.attachSoundButton(heroFrame, heroVideo);
        }
        if (data.hero?.poster && !data.hero.poster.startsWith('idb:')) {
          const normPoster = normalizeImageUrl(data.hero.poster);
          if (heroVideo.poster !== normPoster) heroVideo.poster = normPoster;
        }
        if (data.hero?.video && !data.hero.video.startsWith('idb:')) {
          const normVideo = normalizeVideoUrl(data.hero.video);
          if (normVideo && heroVideo.src !== normVideo) {
            const src = heroVideo.querySelector('source');
            if (src) src.src = normVideo;
            heroVideo.src = normVideo;
          }
        }
      }
    } catch (e) {
      console.error('CMS: Erro ao aplicar textos e mídia do Hero', e);
    }

    // 2. Título e Marcas (Nomes e Logotipos Diretos)
    try {
      const brandsTitle = document.querySelector('#brands-title');
      if (brandsTitle && data.brandsTitle) {
        brandsTitle.innerHTML = sanitizeHtml(data.brandsTitle);
      }

      if (data.brandsList && Array.isArray(data.brandsList)) {
        const brandPills = document.querySelectorAll('.brands-grid .brand-pill');
        data.brandsList.forEach((item, idx) => {
          if (!brandPills[idx] || !item) return;
          const pill = brandPills[idx];
          const circle = pill.querySelector('.brand-pill-circle');
          if (!circle) return;

          if (item.name) {
            pill.title = item.name;
            const nameSpan = circle.querySelector('.brand-name');
            if (nameSpan) {
              const lower = item.name.toLowerCase().trim();
              if (lower === 'fox cycles' || lower === 'fox') {
                circle.innerHTML = '<span class="brand-name">FOX</span><small class="brand-sub">CYCLES</small>';
              } else if (lower === 'mercado livre') {
                circle.innerHTML = '<span class="brand-name">mercado<br>livre</span>';
              } else if (lower === 'upseller erp' || lower === 'upseller') {
                circle.innerHTML = '<span class="brand-name">UpSeller</span>';
              } else {
                nameSpan.textContent = item.name;
              }
            }
          }

          if (item.image && !item.image.startsWith('idb:')) {
            const normImg = normalizeImageUrl(item.image);
            circle.classList.add('has-custom-logo');
            circle.dataset.customLogo = normImg;
            let img = circle.querySelector('img.brand-logo-img');
            if (!img) {
              circle.innerHTML = `<img src="${normImg}" alt="${item.name || ''}" class="brand-logo-img">`;
            } else if (img.src !== normImg) {
              img.src = normImg;
              img.alt = item.name || '';
            }
          }
        });
      }
    } catch (e) {
      console.error('CMS: Erro ao aplicar Marcas', e);
    }

    // 3. Título, intro e Vídeos do Portfólio (Posters e Links Diretos)
    try {
      const portfolioTitle = document.querySelector('#portfolio-title');
      if (portfolioTitle && data.portfolioTitle) {
        portfolioTitle.innerHTML = sanitizeHtml(data.portfolioTitle);
      }

      const portfolioIntro = document.querySelector('.portfolio .section-intro') || document.querySelector('.section-intro');
      if (portfolioIntro && data.portfolioIntro) {
        portfolioIntro.innerHTML = sanitizeHtml(data.portfolioIntro);
      }

      if (data.portfolioVideos && Array.isArray(data.portfolioVideos) && data.portfolioVideos.length > 0) {
        const cards = document.querySelectorAll('.video-card');
        data.portfolioVideos.forEach((item, idx) => {
          if (!cards[idx] || !item) return;
          const video = cards[idx].querySelector('video');
          const metaSpan = cards[idx].querySelector('.video-meta span:first-child');
          if (metaSpan && item.label) {
            metaSpan.innerHTML = item.label;
          }
          if (video) {
            video.controls = false;
            video.removeAttribute('controls');
            video.muted = true;
            if (typeof window !== 'undefined' && window.attachSoundButton) {
              window.attachSoundButton(cards[idx], video);
            }
            if (item.poster && !item.poster.startsWith('idb:')) {
              const normPoster = normalizeImageUrl(item.poster, 300);
              if (video.poster) {
                if (video.poster !== normPoster) video.poster = normPoster;
              } else {
                video.dataset.poster = normPoster;
              }
            }
            if (item.video && !item.video.startsWith('idb:')) {
              const normVideo = normalizeVideoUrl(item.video);
              if (normVideo) {
                const isSocial = normVideo.includes('instagram.com') || normVideo.includes('tiktok.com');
                if (isSocial) {
                  cards[idx].dataset.externalUrl = normVideo;
                } else {
                  delete cards[idx].dataset.externalUrl;
                  const src = video.querySelector('source');
                  if (src && src.src !== normVideo) src.src = normVideo;
                  if (video.src !== normVideo) {
                    video.src = normVideo;
                  }
                }
              }
            }
          }
        });
      }
    } catch (e) {
      console.error('CMS: Erro ao aplicar textos e vídeos do Portfólio', e);
    }

    // 4. Cases Reais ("Cases que saem da tela.")
    try {
      if (data.realCases && Array.isArray(data.realCases)) {
        const cases = document.querySelectorAll('.real-case');
        data.realCases.forEach((item, idx) => {
          if (!cases[idx] || !item) return;
          const el = cases[idx];
          if (item.link) el.href = item.link;
          const tag = el.querySelector('.case-platform-tag') || el.querySelector('.real-case-content span');
          const title = el.querySelector('.real-case-content h3');
          const desc = el.querySelector('.real-case-content p');
          if (tag && item.tag) {
            tag.innerHTML = sanitizeHtml(item.tag);
          }
          if (title && item.title) title.innerHTML = sanitizeHtml(item.title);
          if (desc && item.desc) desc.innerHTML = sanitizeHtml(item.desc);

          const cover = el.querySelector('.real-case-cover');
          if (cover && item.cover && !item.cover.startsWith('idb:')) {
            const normCover = normalizeImageUrl(item.cover);
            cover.style.backgroundImage = `url("${normCover}")`;
            el.dataset.coverUrl = normCover;
          }
        });
      }
    } catch (e) {
      console.error('CMS: Erro ao aplicar Cases Reais', e);
    }

    // 5. Posts do Instagram ("O que está no ar agora.")
    try {
      if (data.instagramPosts && Array.isArray(data.instagramPosts)) {
        const photoCards = document.querySelectorAll('.photo-card');
        data.instagramPosts.forEach((post, idx) => {
          if (!photoCards[idx] || !post) return;
          const card = photoCards[idx];
          if (post.link) card.href = post.link;
          const span = card.querySelector('span');
          if (span && post.label) {
            span.innerHTML = `${sanitizeHtml(post.label)} <b>&#8599;</b>`;
          }
          const img = card.querySelector('img');
          if (img && post.image && !post.image.startsWith('idb:')) {
            const normImg = normalizeImageUrl(post.image);
            if (img.src !== normImg) img.src = normImg;
          }
        });
      }
    } catch (e) {
      console.error('CMS: Erro ao aplicar posts do Instagram', e);
    }

    // 6. Serviços - Título e Cards
    try {
      const servTitle = document.querySelector('#services-title');
      if (servTitle && data.servicesTitle) {
        servTitle.innerHTML = sanitizeHtml(data.servicesTitle);
      }
      if (data.servicesList && Array.isArray(data.servicesList)) {
        const serviceCards = document.querySelectorAll('.service-card');
        data.servicesList.forEach((s, idx) => {
          if (!serviceCards[idx] || !s) return;
          const card = serviceCards[idx];
          const h3 = card.querySelector('h3');
          const p = card.querySelector('p');
          if (h3 && s.title) h3.innerHTML = sanitizeHtml(s.title);
          if (p && s.text) p.innerHTML = sanitizeHtml(s.text);
        });
      }
    } catch (e) {
      console.error('CMS: Erro ao aplicar textos de Serviços', e);
    }

    // 7. Sobre - Título, Bio e Foto da Kelly (Aplicação imediata se for URL/Base64)
    try {
      const aboutTitle = document.querySelector('#about-title');
      if (aboutTitle && data.about?.title) {
        aboutTitle.innerHTML = sanitizeHtml(data.about.title);
      }

      const aboutContentP = document.querySelector('.about-content p:nth-of-type(2)');
      if (aboutContentP && data.about?.bio) {
        aboutContentP.innerHTML = sanitizeHtml(data.about.bio);
      }

      const aboutImg = document.querySelector('.about-image img');
      if (aboutImg && data.about?.image && !data.about.image.startsWith('idb:')) {
        const normImg = normalizeImageUrl(data.about.image);
        if (aboutImg.src !== normImg) {
          aboutImg.src = normImg;
        }
      }
    } catch (e) {
      console.error('CMS: Erro ao aplicar textos e foto da seção Sobre', e);
    }

    // 8. Contato - Título, Email e WhatsApp
    try {
      const contactTitle = document.querySelector('#contact-title');
      if (contactTitle && data.contact?.title) {
        contactTitle.innerHTML = sanitizeHtml(data.contact.title);
      }

      if (data.contact?.email) {
        document.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
          a.href = `mailto:${data.contact.email}`;
          if (a.textContent.includes('@')) a.textContent = data.contact.email;
        });
      }

      if (data.contact?.whatsapp) {
        document.querySelectorAll('a[href*="wa.me"]').forEach((a) => {
          if (data.contact?.whatsappLink) a.href = data.contact.whatsappLink;
          if (a.textContent.includes('+55')) a.textContent = data.contact.whatsapp;
        });
      }
    } catch (e) {
      console.error('CMS: Erro ao aplicar contatos', e);
    }

    // =========================================================================
    // FASE 2: RESOLUÇÃO ASSÍNCRONA PARALELA APENAS PARA MÍDIAS IDB (INDEXEDDB)
    // Executa simultaneamente em segundo plano sem travar nem criar filas
    // =========================================================================

    const asyncTasks = [];

    // 9. Hero Video/Poster IDB
    if (data.hero?.video?.startsWith('idb:') || data.hero?.poster?.startsWith('idb:')) {
      asyncTasks.push((async () => {
        try {
          const heroVideo = document.querySelector('.hero-frame video');
          if (!heroVideo) return;
          if (data.hero.video?.startsWith('idb:')) {
            const raw = await kmMediaStore.resolveUrl(data.hero.video);
            const resolved = normalizeVideoUrl(raw);
            if (resolved) {
              const src = heroVideo.querySelector('source');
              if (src) src.src = resolved;
              heroVideo.src = resolved;
            }
          }
          if (data.hero.poster?.startsWith('idb:')) {
            const resolved = await kmMediaStore.resolveUrl(data.hero.poster);
            if (resolved && heroVideo.poster !== resolved) heroVideo.poster = resolved;
          }
        } catch (e) {
          console.warn('CMS: Erro ao resolver mídia IDB do Hero', e);
        }
      })());
    }

    // 10. Marcas IDB
    if (data.brandsList && Array.isArray(data.brandsList)) {
      data.brandsList.forEach((item, idx) => {
        if (item?.image?.startsWith('idb:')) {
          asyncTasks.push((async () => {
            try {
              const brandPills = document.querySelectorAll('.brands-grid .brand-pill');
              const pill = brandPills[idx];
              const circle = pill?.querySelector('.brand-pill-circle');
              if (!circle) return;
              const resolved = await kmMediaStore.resolveUrl(item.image);
              if (resolved) {
                circle.classList.add('has-custom-logo');
                circle.dataset.customLogo = item.image;
                let img = circle.querySelector('img.brand-logo-img');
                if (!img) {
                  circle.innerHTML = `<img src="${resolved}" alt="${item.name || ''}" class="brand-logo-img">`;
                } else {
                  img.src = resolved;
                }
              }
            } catch (e) {}
          })());
        }
      });
    }

    // 11. Vídeos do Portfólio IDB
    if (data.portfolioVideos && Array.isArray(data.portfolioVideos)) {
      data.portfolioVideos.forEach((item, idx) => {
        if (item?.video?.startsWith('idb:') || item?.poster?.startsWith('idb:')) {
          asyncTasks.push((async () => {
            try {
              const cards = document.querySelectorAll('.video-card');
              const video = cards[idx]?.querySelector('video');
              if (!video) return;
              if (item.video?.startsWith('idb:')) {
                const resolved = await kmMediaStore.resolveUrl(item.video);
                if (resolved) {
                  const src = video.querySelector('source');
                  if (src) src.src = resolved;
                  video.src = resolved;
                }
              }
              if (item.poster?.startsWith('idb:')) {
                const resolved = await kmMediaStore.resolveUrl(item.poster);
                if (resolved && video.poster !== resolved) video.poster = resolved;
              }
            } catch (e) {}
          })());
        }
      });
    }

    // 12. Cases Reais IDB
    if (data.realCases && Array.isArray(data.realCases)) {
      data.realCases.forEach((item, idx) => {
        if (item?.cover?.startsWith('idb:')) {
          asyncTasks.push((async () => {
            try {
              const cases = document.querySelectorAll('.real-case');
              const cover = cases[idx]?.querySelector('.real-case-cover');
              if (!cover) return;
              const resolved = await kmMediaStore.resolveUrl(item.cover);
              if (resolved) {
                cover.style.backgroundImage = `url("${resolved}")`;
                cases[idx].dataset.coverUrl = item.cover;
              }
            } catch (e) {}
          })());
        }
      });
    }

    // 13. Instagram Posts IDB
    if (data.instagramPosts && Array.isArray(data.instagramPosts)) {
      data.instagramPosts.forEach((post, idx) => {
        if (post?.image?.startsWith('idb:')) {
          asyncTasks.push((async () => {
            try {
              const photoCards = document.querySelectorAll('.photo-card');
              const img = photoCards[idx]?.querySelector('img');
              if (!img) return;
              const resolved = await kmMediaStore.resolveUrl(post.image);
              if (resolved && img.src !== resolved) {
                img.src = resolved;
              }
            } catch (e) {}
          })());
        }
      });
    }

    // 14. Foto da Kelly IDB (Sobre)
    if (data.about?.image?.startsWith('idb:')) {
      asyncTasks.push((async () => {
        try {
          const aboutImg = document.querySelector('.about-image img');
          if (!aboutImg) return;
          const resolved = await kmMediaStore.resolveUrl(data.about.image);
          if (resolved && aboutImg.src !== resolved) {
            aboutImg.src = resolved;
          }
        } catch (e) {}
      })());
    }

    if (asyncTasks.length > 0) {
      await Promise.allSettled(asyncTasks);
    }
  }
}

// Inicializa e expõe no escopo global
let kmCMS = null;
if (typeof window !== 'undefined') {
  kmCMS = new KMCMS();
  window.kmCMS = kmCMS;
  window.KMCMS = KMCMS;
  window.normalizeVideoUrl = normalizeVideoUrl;
}

// Execução ao carregar no browser
if (typeof document !== 'undefined') {
  const boot = async () => {
    await kmCMS?.applyToPage();
    // Remove o escudo anti-FOIC: o applyToPage() já aplicou as URLs corretas,
    // então o placeholder HTML estático já foi sobrescrito com segurança.
    document.getElementById('km-foic-shield')?.remove();
    kmCMS?.fetchPublishedContent();
  };

  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    boot();
  } else {
    document.addEventListener('DOMContentLoaded', boot);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { KMCMS, KMMediaStore, normalizeVideoUrl, deepMerge, defaultCMSContent };
}

// Sincronização em tempo real entre abas:
// 1. BroadcastChannel
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    const channel = new BroadcastChannel('km_cms_channel');
    channel.onmessage = (event) => {
      if (event.data && event.data.type === 'CONTENT_UPDATED') {
        kmCMS.data = event.data.data;
        kmCMS.applyToPage();
      }
    };
  } catch (e) {
    console.warn('CMS: BroadcastChannel listener warning', e);
  }
}

// 2. Storage event padrão universal (disparado entre abas no mesmo origin)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === KM_CMS_STORAGE_KEY || event.key === KM_CMS_SYNC_KEY) {
      kmCMS.reloadAndApply();
    }
  });

  // 3. PostMessage (para comunicação quando aberta via popup/opener) — valida origem
  window.addEventListener('message', (event) => {
    // Aceita apenas mensagens da mesma origem (mesmo domínio/localhost)
    if (event.origin !== window.location.origin) return;
    if (event.data && event.data.type === 'CONTENT_UPDATED' && event.data.data) {
      kmCMS.data = event.data.data;
      kmCMS.applyToPage();
    }
  });
}
