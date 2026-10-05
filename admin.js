/**
 * KMORAIS - Painel de Controle Administrativo (In-Place Editor)
 */

// Clean URLs: remove .html da barra de navegação mantendo rota /admin elegante
(function cleanUrl() {
  if (window.history && window.history.replaceState) {
    var p = window.location.pathname;
    if (p.endsWith('.html')) {
      var c = p.replace(/\.html$/, '');
      window.history.replaceState(null, '', c + window.location.search + window.location.hash);
    }
  }
})();

// Hash SHA-256 com salt da senha de acesso — impossibilita busca reversa via rainbow tables.
const ADMIN_PASSWORD_HASH = '8243a0708a330f94d01a004351968dfb8a8254ff11aa2abfb32faff04864a92a';
const ADMIN_SALT = ':km_salt_v2_9f8b2c';
const AUTH_SESSION_KEY = 'km_admin_authenticated';
const KM_GH_CONFIG_KEY = 'km_github_sync_config_v1';
const KM_LOGIN_ATTEMPTS_KEY = 'km_admin_login_attempts';
const KM_LOGIN_LOCKOUT_KEY = 'km_admin_login_lockout';

// Função SHA-256 via Web Crypto API (assíncrona, nativa do browser)
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUtf8(value) {
  const binary = atob(value.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// Rate limiting: bloqueia login após 5 tentativas erradas por 30 segundos
function isLoginLocked() {
  const lockoutUntil = Number(sessionStorage.getItem(KM_LOGIN_LOCKOUT_KEY) || 0);
  return Date.now() < lockoutUntil;
}

function getRemainingLockout() {
  const lockoutUntil = Number(sessionStorage.getItem(KM_LOGIN_LOCKOUT_KEY) || 0);
  return Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
}

function recordFailedAttempt() {
  const attempts = Number(sessionStorage.getItem(KM_LOGIN_ATTEMPTS_KEY) || 0) + 1;
  sessionStorage.setItem(KM_LOGIN_ATTEMPTS_KEY, String(attempts));
  if (attempts >= 5) {
    const lockUntil = Date.now() + 30000; // 30 segundos
    sessionStorage.setItem(KM_LOGIN_LOCKOUT_KEY, String(lockUntil));
    sessionStorage.setItem(KM_LOGIN_ATTEMPTS_KEY, '0');
  }
}

function clearLoginAttempts() {
  sessionStorage.removeItem(KM_LOGIN_ATTEMPTS_KEY);
  sessionStorage.removeItem(KM_LOGIN_LOCKOUT_KEY);
}

function getGitHubConfig() {
  const defaults = {
    token: '',
    repo: 'abreumarcelo1994/kmorais',
    branch: 'main',
    path: 'content.json'
  };
  try {
    const saved = localStorage.getItem(KM_GH_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return Object.assign({}, defaults, parsed);
    }
  } catch (e) {}
  return defaults;
}


function saveGitHubConfig(cfg) {
  try {
    // Nota: token salvo em localStorage como texto puro — seguro pois é client-only e
    // nunca enviado ao servidor. Não compartilhe o dispositivo sem logout.
    localStorage.setItem(KM_GH_CONFIG_KEY, JSON.stringify(cfg));
    return true;
  } catch (e) {
    return false;
  }
}

// Ativação simplificada de token em outro dispositivo via URL hash segura
// Ex: https://kellymorais.com.br/admin#setupToken=ghp_...
(function checkSetupTokenInUrl() {
  try {
    const hash = window.location.hash || '';
    if (hash.includes('setupToken=')) {
      const match = hash.match(/setupToken=([^&]+)/);
      if (match && match[1]) {
        const token = decodeURIComponent(match[1]).trim();
        if (token && !token.includes('*')) {
          const cfg = getGitHubConfig();
          cfg.token = token;
          saveGitHubConfig(cfg);
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          setTimeout(() => {
            alert('✓ Conexão com o GitHub ativada com sucesso neste dispositivo! Agora você pode enviar vídeos e fotos direto para o site.');
          }, 350);
        }
      }
    }
  } catch (e) {}
})();

function normalizeVideoUrl(url) {
  if (!url || typeof url !== 'string') return '';
  url = url.trim();

  const driveMatch = url.match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+))/);
  if (driveMatch) {
    const fileId = driveMatch[1] || driveMatch[2];
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
  if (url.includes('dropbox.com') && url.includes('dl=0')) {
    return url.replace('dl=0', 'raw=1');
  }
  return url;
}

function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  url = url.trim();

  const legacyMediaPrefix = 'https://abreumarcelo1994.github.io/kmorais/media/';
  if (url.startsWith(legacyMediaPrefix)) {
    return `https://raw.githubusercontent.com/abreumarcelo1994/kmorais/main/media/${url.slice(legacyMediaPrefix.length)}`;
  }
  if (url.startsWith('data:image/webp') || url.startsWith('blob:') || url.startsWith('idb:')) return url;

  if (url.includes('images.unsplash.com')) {
    try {
      const u = new URL(url);
      u.searchParams.set('auto', 'format,compress');
      u.searchParams.set('fit', 'crop');
      u.searchParams.set('fm', 'webp');
      const curW = Number(u.searchParams.get('w'));
      if (!curW || curW > 300) u.searchParams.set('w', '300');
      const curQ = Number(u.searchParams.get('q'));
      if (!curQ || curQ > 45) u.searchParams.set('q', '45');
      return u.toString();
    } catch (_) {
      return url;
    }
  }
  if (url.includes('res.cloudinary.com') && url.includes('/image/upload/') && !url.includes('f_auto') && !url.includes('f_webp')) {
    return url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
  }
  return url;
}

function getImageMimeType(file) {
  if (!file) return '';
  const declaredType = typeof file.type === 'string' ? file.type.toLowerCase() : '';
  if (declaredType.startsWith('image/')) return declaredType;

  const extension = String(file.name || '').split('.').pop().toLowerCase();
  const imageTypes = {
    avif: 'image/avif',
    bmp: 'image/bmp',
    gif: 'image/gif',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    svg: 'image/svg+xml',
    webp: 'image/webp'
  };
  return imageTypes[extension] || '';
}

function withImageMimeType(file, mimeType) {
  if (!mimeType || file.type === mimeType) return file;
  return new File([file], file.name, { type: mimeType, lastModified: file.lastModified });
}

async function verifyPublicImage(url, onProgress) {
  const retryDelays = [0, 500, 1200];
  let lastUrl = url;

  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    if (retryDelays[attempt]) {
      await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
    }

    lastUrl = attempt === 0
      ? url
      : `${url}${url.includes('?') ? '&' : '?'}verify=${Date.now()}-${attempt}`;
    if (onProgress) onProgress(`Verificando acesso público à imagem (${attempt + 1}/${retryDelays.length})...`);

    try {
      await new Promise((resolve, reject) => {
        const image = new Image();
        const timeoutId = setTimeout(() => {
          image.onload = null;
          image.onerror = null;
          reject(new Error('Tempo limite ao carregar imagem'));
        }, 10000);

        image.onload = () => {
          clearTimeout(timeoutId);
          if (image.naturalWidth > 0) resolve();
          else reject(new Error('A imagem carregou sem dimensões válidas'));
        };
        image.onerror = () => {
          clearTimeout(timeoutId);
          reject(new Error('A URL pública ainda não está acessível'));
        };
        image.src = lastUrl;
      });
      return lastUrl;
    } catch (_) {}
  }

  throw new Error('O GitHub recebeu a imagem, mas ela não abriu publicamente após algumas tentativas. Ela não foi aplicada ao site; tente novamente em instantes.');
}

async function githubApiRequest(cfg, endpoint, method = 'GET', payload = null) {
  const response = await fetch(`https://api.github.com/repos/${cfg.repo}/${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${cfg.token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    ...(payload ? { body: JSON.stringify(payload) } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('(401) Bad credentials — O token do GitHub inserido é inválido ou expirou.');
    }
    if (response.status === 422 && /too large|input was too large/i.test(data.message || '')) {
      const error = new Error('O GitHub recusou o vídeo porque o corpo Base64 ficou grande demais. O limite seguro deste painel é 32 MiB; para vídeos maiores, cole um link do Cloudinary, Google Drive ou Dropbox.');
      error.status = response.status;
      throw error;
    }
    const error = new Error(`GitHub API falhou (${response.status}): ${data.message || 'erro desconhecido'}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function uploadLargeFileToGitHub(cfg, filePath, base64Content, onProgress) {
  const branch = cfg.branch || 'main';
  const branchRef = `heads/${branch.split('/').map(encodeURIComponent).join('/')}`;

  if (onProgress) onProgress('Preparando vídeo grande no GitHub...');
  const blob = await githubApiRequest(cfg, 'git/blobs', 'POST', {
    content: base64Content,
    encoding: 'base64'
  });

  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const refData = await githubApiRequest(cfg, `git/ref/${branchRef}`);
    const parentSha = refData.object?.sha;
    if (!parentSha) throw new Error('Não foi possível localizar a versão atual do branch no GitHub.');

    const parentCommit = await githubApiRequest(cfg, `git/commits/${parentSha}`);
    const tree = await githubApiRequest(cfg, 'git/trees', 'POST', {
      base_tree: parentCommit.tree.sha,
      tree: [{ path: filePath, mode: '100644', type: 'blob', sha: blob.sha }]
    });
    const commit = await githubApiRequest(cfg, 'git/commits', 'POST', {
      message: 'media: upload de video grande via painel administrativo',
      tree: tree.sha,
      parents: [parentSha]
    });

    try {
      await githubApiRequest(cfg, `git/refs/${branchRef}`, 'PATCH', {
        sha: commit.sha,
        force: false
      });
      return commit;
    } catch (error) {
      lastError = error;
      if (![409, 422].includes(error.status) || attempt === 2) throw error;
      if (onProgress) onProgress('Houve outro salvamento; sincronizando e tentando novamente...');
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }

  throw lastError || new Error('Não foi possível publicar o vídeo grande no GitHub.');
}

async function fetchGitHubTextFile(cfg, filePath, branch) {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const data = await githubApiRequest(cfg, `contents/${encodedPath}?ref=${encodeURIComponent(branch)}`);
  if (!data.content || data.encoding !== 'base64') {
    throw new Error(`O arquivo ${filePath} não retornou conteúdo editável pelo GitHub API.`);
  }
  return base64ToUtf8(data.content);
}

async function commitFilesToGitHub(cfg, files, onProgress) {
  const branch = cfg.branch || 'main';
  const branchRef = `heads/${branch.split('/').map(encodeURIComponent).join('/')}`;
  let lastError;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const refData = await githubApiRequest(cfg, `git/ref/${branchRef}`);
    const parentSha = refData.object?.sha;
    if (!parentSha) throw new Error('Não foi possível localizar a versão atual do branch no GitHub.');

    const parentCommit = await githubApiRequest(cfg, `git/commits/${parentSha}`);
    const entries = await Promise.all(files.map(async (file) => {
      const blob = await githubApiRequest(cfg, 'git/blobs', 'POST', {
        content: file.content,
        encoding: 'utf-8'
      });
      return { path: file.path, mode: '100644', type: 'blob', sha: blob.sha };
    }));
    const tree = await githubApiRequest(cfg, 'git/trees', 'POST', {
      base_tree: parentCommit.tree.sha,
      tree: entries
    });
    const commit = await githubApiRequest(cfg, 'git/commits', 'POST', {
      message: 'cms: publica conteudo e documentos sincronizados',
      tree: tree.sha,
      parents: [parentSha]
    });

    try {
      await githubApiRequest(cfg, `git/refs/${branchRef}`, 'PATCH', {
        sha: commit.sha,
        force: false
      });
      return commit;
    } catch (error) {
      lastError = error;
      if (![409, 422].includes(error.status) || attempt === 2) throw error;
      if (onProgress) onProgress(`Outro dispositivo publicou durante o envio; sincronizando (${attempt + 2}/3)...`);
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }

  throw lastError || new Error('Não foi possível publicar os arquivos sincronizados no GitHub.');
}

function updateCategoryHtml(html, categories, brands = []) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  let changed = false;

  categories.forEach((category) => {
    if (!category?.id) return;
    const filterButton = Array.from(parsed.querySelectorAll('[data-filter]'))
      .find(button => button.dataset.filter === category.id);
    const filterLabel = filterButton?.querySelector('.filter-text');
    const categoryBlock = Array.from(parsed.querySelectorAll('[data-category]'))
      .find(block => block.dataset.category === category.id);
    const heading = categoryBlock?.querySelector('.category-head h3');
    const description = categoryBlock?.querySelector('.category-head p');

    if (category.name) {
      if (filterLabel && filterLabel.textContent !== category.name) {
        filterLabel.textContent = category.name;
        changed = true;
      } else if (!filterLabel && filterButton && filterButton.textContent.trim() !== category.name) {
        filterButton.textContent = category.name;
        changed = true;
      }
      if (heading && heading.textContent.trim() !== category.name) {
        heading.textContent = category.name;
        changed = true;
      }
    }
    if (description && category.description && description.textContent.trim() !== category.description) {
      description.textContent = category.description;
      changed = true;
    }
  });

  const brandPills = parsed.querySelectorAll('.brands-grid .brand-pill');
  brands.forEach((brand, index) => {
    const pill = brandPills[index];
    if (!pill || !brand.name) return;
    if (pill.title !== brand.name) {
      pill.title = brand.name;
      changed = true;
    }
    const image = pill.querySelector('img.brand-logo-img');
    if (image && image.alt !== brand.name) {
      image.alt = brand.name;
      changed = true;
    }
  });

  return changed ? `<!DOCTYPE html>\n${parsed.documentElement.outerHTML}` : html;
}

function updateLlmsCategories(llmsText, categories) {
  const startMarker = '<!-- KM_CMS_CATEGORIES_START -->';
  const endMarker = '<!-- KM_CMS_CATEGORIES_END -->';
  const start = llmsText.indexOf(startMarker);
  const end = llmsText.indexOf(endMarker);
  if (start < 0 || end < start) throw new Error('Marcadores de categorias ausentes no llms.txt.');

  const names = categories.map(category => category.name.replace(/[\r\n]/g, ' ').trim()).filter(Boolean);
  const block = `${startMarker}\n${names.join(', ')}.\n${endMarker}`;
  return `${llmsText.slice(0, start)}${block}${llmsText.slice(end + endMarker.length)}`;
}

function updateLlmsBrands(llmsText, brands, previousBrands = []) {
  const startMarker = '<!-- KM_CMS_BRANDS_START -->';
  const endMarker = '<!-- KM_CMS_BRANDS_END -->';
  if (!llmsText.includes(startMarker) || !llmsText.includes(endMarker)) {
    throw new Error('Marcadores de marcas ausentes no llms.txt.');
  }

  const replacements = new Map();
  previousBrands.forEach((previous, index) => {
    const oldName = String(previous?.name || '').trim();
    const newName = String(brands[index]?.name || '').trim();
    if (!oldName || !newName || oldName.toLowerCase() === newName.toLowerCase()) return;
    replacements.set(oldName.toLowerCase(), newName);
  });
  if (replacements.size) {
    const pattern = Array.from(replacements.keys())
      .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    llmsText = llmsText.replace(new RegExp(pattern, 'gi'), name => replacements.get(name.toLowerCase()) || name);
  }

  const start = llmsText.indexOf(startMarker);
  const end = llmsText.indexOf(endMarker, start + startMarker.length);
  const names = brands.map(brand => String(brand.name || '').replace(/[\r\n]/g, ' ').trim()).filter(Boolean);
  const block = `${startMarker}\n${names.join(', ')}.\n${endMarker}`;
  return `${llmsText.slice(0, start)}${block}${llmsText.slice(end + endMarker.length)}`;
}

function updateSitemapCategories(sitemapText, categories, brands = []) {
  const xml = new DOMParser().parseFromString(sitemapText, 'application/xml');
  if (xml.getElementsByTagName('parsererror').length) throw new Error('O sitemap.xml atual não é XML válido.');

  const sitemapNs = 'http://www.sitemaps.org/schemas/sitemap/0.9';
  const videoNs = 'http://www.google.com/schemas/sitemap-video/1.1';
  const lastmod = xml.getElementsByTagNameNS(sitemapNs, 'lastmod')[0];
  if (lastmod) {
    lastmod.textContent = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, '-03:00');
  }

  const video = xml.getElementsByTagNameNS(videoNs, 'video')[0];
  if (!video) throw new Error('O sitemap.xml não contém um VideoObject para associar às categorias.');
  const children = Array.from(video.childNodes);
  const start = children.find(node => node.nodeType === 8 && node.data.trim() === 'KM_CMS_CATEGORIES_START');
  const end = children.find(node => node.nodeType === 8 && node.data.trim() === 'KM_CMS_CATEGORIES_END');
  if (!start || !end) throw new Error('Marcadores de categorias ausentes no sitemap.xml.');

  let node = start.nextSibling;
  while (node && node !== end) {
    const next = node.nextSibling;
    video.removeChild(node);
    node = next;
  }
  categories.forEach((category) => {
    if (!category.name) return;
    const tag = xml.createElementNS(videoNs, 'video:tag');
    tag.textContent = category.name;
    video.insertBefore(xml.createTextNode('\n      '), end);
    video.insertBefore(tag, end);
  });
  video.insertBefore(xml.createTextNode('\n      '), end);

  const imageNs = 'http://www.google.com/schemas/sitemap-image/1.1';
  const page = xml.getElementsByTagNameNS(sitemapNs, 'url')[0];
  const pageChildren = Array.from(page.childNodes);
  const brandsStart = pageChildren.find(child => child.nodeType === 8 && child.data.trim() === 'KM_CMS_BRANDS_START');
  const brandsEnd = pageChildren.find(child => child.nodeType === 8 && child.data.trim() === 'KM_CMS_BRANDS_END');
  if (!brandsStart || !brandsEnd) throw new Error('Marcadores de logos ausentes no sitemap.xml.');

  let brandNode = brandsStart.nextSibling;
  while (brandNode && brandNode !== brandsEnd) {
    const next = brandNode.nextSibling;
    page.removeChild(brandNode);
    brandNode = next;
  }
  brands.forEach((brand) => {
    if (!/^https?:\/\//i.test(brand.image || '')) return;
    const image = xml.createElementNS(imageNs, 'image:image');
    const location = xml.createElementNS(imageNs, 'image:loc');
    const title = xml.createElementNS(imageNs, 'image:title');
    const caption = xml.createElementNS(imageNs, 'image:caption');
    location.textContent = brand.image;
    title.textContent = `Logo ${brand.name}`;
    caption.textContent = `Marca atendida por Kelly Morais em campanhas de conteúdo UGC.`;
    image.append(location, title, caption);
    page.insertBefore(xml.createTextNode('\n    '), brandsEnd);
    page.insertBefore(image, brandsEnd);
  });
  page.insertBefore(xml.createTextNode('\n    '), brandsEnd);

  const serialized = new XMLSerializer().serializeToString(xml);
  return serialized.startsWith('<?xml') ? serialized : `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`;
}

/**
 * Converte qualquer arquivo de imagem para o padrão WebP diretamente no navegador.
 * - Vetores SVG são mantidos como SVG puros para máxima nitidez vetorial.
 * - Imagens raster (PNG, JPG, JPEG, BMP, etc.) são redimensionadas proporcionalmente (máx 1280px)
 *   e convertidas para WebP a 80% de qualidade via Canvas HTML5.
 * - Retorna { file: File (webp), dataUrl: string, originalSize, newSize, isSvg }
 */
function convertImageToWebp(file, maxWidth = 800, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const imageMimeType = getImageMimeType(file);
    if (!imageMimeType) {
      resolve(null);
      return;
    }
    file = withImageMimeType(file, imageMimeType);

    // Para SVGs, preserva vetor puro sem perda
    if (imageMimeType === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = (e) => resolve({
        file,
        dataUrl: e.target.result,
        originalSize: file.size,
        newSize: file.size,
        isSvg: true
      });
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxWidth) {
          width = Math.round((width * maxWidth) / height);
          height = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // 1. Gera Data URL em WebP
        let webpDataUrl = canvas.toDataURL('image/webp', quality);
        const canWebp = webpDataUrl.startsWith('data:image/webp');
        if (!canWebp) {
          webpDataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        const mimeType = canWebp ? 'image/webp' : 'image/jpeg';
        const ext = canWebp ? '.webp' : '.jpg';

        // 2. Gera File/Blob em WebP
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve({
              file,
              dataUrl: webpDataUrl,
              originalSize: file.size,
              newSize: file.size,
              isSvg: false
            });
            return;
          }

          const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
          const webpFile = new File([blob], `${baseName}${ext}`, { type: blob.type || mimeType });
          resolve({
            file: webpFile,
            dataUrl: webpDataUrl,
            originalSize: file.size,
            newSize: blob.size,
            isSvg: false
          });
        }, mimeType, quality);
      };
      img.onerror = () => resolve({
        file,
        dataUrl: e.target.result,
        originalSize: file.size,
        newSize: file.size,
        isSvg: false
      });
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Garante que mídias portáveis (URLs completas, caminhos relativos e Data URLs em Base64)
 * sejam preservadas em produção no content.json, em vez de IDs locais do IndexedDB.
 */
function getPortableMediaVal(primaryVal, fallbackIdbId) {
  if (primaryVal && typeof primaryVal === 'string') {
    const trimmed = primaryVal.trim();
    if (trimmed.startsWith('data:image/') && trimmed.length < 250000) {
      return trimmed;
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('media/') || trimmed.startsWith('./') || trimmed.startsWith('/')) {
      return trimmed;
    }
  }
  // Bloqueio rigoroso: NUNCA salvar idb: nem blob: no content.json de produção
  return '';
}

/**
 * Faz upload de uma mídia para media/ e retorna uma URL pública validada.
 * Imagens usam GitHub Raw imutável; vídeos usam GitHub Pages.
 * Retorna null se o token não estiver configurado.
 */
async function uploadFileToGitHub(file, onProgress) {
  const cfg = getGitHubConfig();
  if (!cfg || !cfg.token || cfg.token.includes('*')) {
    throw new Error('Dispositivo sem token do GitHub configurado. Conecte o GitHub no botão superior para enviar arquivos para a nuvem.');
  }
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new Error('Arquivo de mídia inválido. Selecione a imagem ou o vídeo novamente.');
  }

  const imageMimeType = getImageMimeType(file);
  const isImage = Boolean(imageMimeType);
  if (isImage) file = withImageMimeType(file, imageMimeType);

  const maxBytes = 32 * 1024 * 1024;
  const contentsApiMaxBytes = 24 * 1024 * 1024;

  // Se for imagem (exceto SVG), converte e otimiza para WebP antes do envio
  if (isImage && imageMimeType !== 'image/svg+xml' && imageMimeType !== 'image/webp') {
    if (onProgress) onProgress('Otimizando imagem para WebP...');
    try {
      const webpResult = await convertImageToWebp(file, 600, 0.70);
      if (webpResult && webpResult.file) {
        file = webpResult.file;
      }
    } catch (e) {
      console.warn('Falha na conversão WebP, enviando arquivo original:', e);
    }
  }

  if (file.size > maxBytes) {
    throw new Error(`O limite deste painel é de 32 MiB por arquivo para manter o corpo Base64 dentro do limite da API do GitHub. Para vídeos maiores, hospede no Cloudinary, Google Drive ou Dropbox e cole o link.`);
  }

  if (onProgress) onProgress('Convertendo arquivo...');

  // 1. Ler o arquivo como ArrayBuffer e converter para base64 em blocos de 8KB (ultra-rápido e seguro contra estouro de memória)
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 8192;
  const len = uint8.length;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = uint8.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk);
  }
  const base64Content = btoa(binary);

  // 2. Gerar nome único para o arquivo: media/timestamp_nome-sanitizado.ext
  let safeName = file.name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9._-]/g, '_')                  // caracteres seguros
    .toLowerCase();

  // Garante extensão .webp no nome se for WebP
  if (file.type === 'image/webp' && !safeName.endsWith('.webp')) {
    safeName = safeName.replace(/\.[^.]+$/, '') + '.webp';
  }

  const ts = Date.now();
  const filePath = `media/${ts}_${safeName}`;

  if (onProgress) onProgress('Enviando para o GitHub...');

  // 3. Verificar se já existe (precisa do SHA para atualizar pelo Contents API)
  let existingSha = null;
  if (file.size <= contentsApiMaxBytes) try {
    const checkRes = await fetch(
      `https://api.github.com/repos/${cfg.repo}/contents/${filePath}?ref=${cfg.branch}&_t=${ts}`,
      {
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${cfg.token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );
    if (checkRes.ok) {
      const data = await checkRes.json();
      existingSha = data.sha || null;
    }
  } catch (_) {}

  // 4. Arquivos pequenos usam Contents API; arquivos grandes usam Git Data API.
  const payload = {
    message: `media: upload de midia via painel administrativo`,
    content: base64Content,
    branch: cfg.branch || 'main'
  };
  if (existingSha) payload.sha = existingSha;

  let putData;
  if (file.size > contentsApiMaxBytes) {
    putData = {
      commit: await uploadLargeFileToGitHub(cfg, filePath, base64Content, onProgress)
    };
  } else {
    const putRes = await fetch(
      `https://api.github.com/repos/${cfg.repo}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${cfg.token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({}));
      if (putRes.status === 401) {
        throw new Error(`(401) Bad credentials — O token do GitHub inserido é inválido, expirou ou foi copiado com asteriscos. Se você copiou da tela de edição do GitHub, clique em "Regenerate token" para gerar um código visível.`);
      }
      throw new Error(`GitHub upload falhou (${putRes.status}): ${err.message || 'erro desconhecido'}`);
    }

    putData = await putRes.json().catch(() => ({}));
  }

  // Imagens usam GitHub Raw; vídeos continuam no GitHub Pages.
  const [owner, repoName] = (cfg.repo || '').split('/');
  let publicUrl = isImage
    ? `https://raw.githubusercontent.com/${owner}/${repoName}/${putData.commit?.sha || encodeURIComponent(cfg.branch || 'main')}/${filePath}`
    : `https://${owner}.github.io/${repoName}/${filePath}`;

  if (isImage) {
    publicUrl = await verifyPublicImage(publicUrl, onProgress);
  }

  if (onProgress) onProgress('✓ Upload concluído!');
  return publicUrl;
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function compressImageFile(file, maxWidth = 1280, quality = 0.8) {
  const res = await convertImageToWebp(file, maxWidth, quality);
  return res ? res.dataUrl : null;
}

class KMAdminPanel {
  constructor() {
    this.authOverlay = document.getElementById('admin-auth-overlay');
    this.loginForm = document.getElementById('admin-login-form');
    this.loginInput = document.getElementById('admin-password-input');
    this.loginError = document.getElementById('admin-login-error');
    this.mediaModal = document.getElementById('admin-media-modal');
    this.currentEditingMedia = null;
    this.selectedVideoFile = null;
    this.selectedPosterFile = null;
    this.videoDropzoneCtrl = null;
    this.posterDropzoneCtrl = null;
    this.isSaving = false;

    this.initAuth();
  }

  initAuth() {
    const isAuth = sessionStorage.getItem(AUTH_SESSION_KEY) === 'true';
    if (isAuth) {
      this.unlockAdmin();
    } else {
      this.lockAdmin();
    }

    if (this.loginForm) {
      this.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Rate limiting: bloqueia se houve muitas tentativas erradas
        if (isLoginLocked()) {
          const secs = getRemainingLockout();
          if (this.loginError) {
            this.loginError.style.display = 'block';
            this.loginError.textContent = `⏳ Muitas tentativas. Aguarde ${secs}s antes de tentar novamente.`;
          }
          return;
        }

        const pwd = this.loginInput.value.trim();
        const pwdHash = await sha256(pwd + ADMIN_SALT);

        if (pwdHash === ADMIN_PASSWORD_HASH) {
          clearLoginAttempts();
          sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
          if (this.loginError) this.loginError.style.display = 'none';
          this.unlockAdmin();
        } else {
          recordFailedAttempt();
          if (this.loginError) {
            this.loginError.style.display = 'block';
            if (isLoginLocked()) {
              this.loginError.textContent = '⛔ Acesso bloqueado por 30s após muitas tentativas erradas.';
            } else {
              const attempts = Number(sessionStorage.getItem(KM_LOGIN_ATTEMPTS_KEY) || 0);
              this.loginError.textContent = `⚠️ Senha incorreta. Tentativa ${attempts}/5.`;
            }
          }
          this.loginInput.value = '';
          this.loginInput.focus();
        }
      });
    }
  }

  lockAdmin() {
    if (this.authOverlay) {
      this.authOverlay.classList.remove('is-hidden');
    }
    document.body.classList.remove('is-admin-mode');
  }

  unlockAdmin() {
    if (this.authOverlay) {
      this.authOverlay.classList.add('is-hidden');
    }
    document.body.classList.add('is-admin-mode');

    // Inicializa a barra e ferramentas de edição
    this.setupEditableElements();
    this.setupMediaButtons();
    this.setupToolbar();
    this.setupMediaModal();
    this.setupGitHubSync();
    this.setupJSONBackup();
    this.updateGitHubWarningBar();
    this.syncRemoteContentOnLoad();
  }

  updateGitHubWarningBar() {
    const warnBar = document.getElementById('admin-gh-warning-bar');
    if (!warnBar) return;
    const cfg = getGitHubConfig();
    const isConnected = cfg && cfg.token && !cfg.token.includes('*');
    if (isConnected) {
      warnBar.classList.add('is-hidden');
    } else {
      warnBar.classList.remove('is-hidden');
    }
  }

  async syncRemoteContentOnLoad() {
    try {
      const res = await fetch(`content.json?_t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const remote = await res.json();
      if (!remote || !remote.updatedAt) return;

      const localSaved = localStorage.getItem(KM_CMS_STORAGE_KEY);
      const localSyncTimestamp = Number(localStorage.getItem(KM_CMS_SYNC_KEY) || 0);
      let localTimestamp = 0;
      if (localSaved) {
        try {
          const parsed = JSON.parse(localSaved);
          localTimestamp = parsed.updatedAt ? new Date(parsed.updatedAt).getTime() : 0;
        } catch (_) {}
      }

      const remoteTimestamp = new Date(remote.updatedAt).getTime();
      const localIsConfirmed = localTimestamp > 0 && localSyncTimestamp === localTimestamp;
      if (this.hasUnsavedChanges) return;

      if (!localIsConfirmed || remoteTimestamp > localTimestamp) {
        console.log('[Admin] Conteúdo mais recente detectado no GitHub. Sincronizando tela...');
        if (window.kmCMS) {
          window.kmCMS.data = deepMerge(defaultCMSContent, remote);
          localStorage.setItem(KM_CMS_STORAGE_KEY, JSON.stringify(window.kmCMS.data));
          localStorage.setItem(KM_CMS_SYNC_KEY, String(new Date(window.kmCMS.data.updatedAt).getTime()));
          await window.kmCMS.applyToPage();
          this.showToast('ℹ️ Painel sincronizado com a versão mais recente da nuvem.');
        }
      }
    } catch (e) {
      console.warn('[Admin] Não foi possível verificar dados remotos no início:', e);
    }
  }

  setupEditableElements() {
    if (this._editableDone) return;
    this._editableDone = true;

    window.addEventListener('beforeunload', (e) => {
      if (this.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Você tem alterações pendentes que ainda não foram salvas e publicadas.';
      }
    });

    const textSelectors = [
      '#hero-title', '.hero-text', '.hero-copy .eyebrow', '.hero-sticker',
      '#brands-title', '#portfolio-title', '.portfolio .section-intro',
      '.category-head h3', '.category-head p', '.video-meta span:first-child',
      '#about-title', '.about-content p:nth-of-type(2)', '#services-title',
      '.service-card h3', '.service-card p', '.stats-row strong', '.stats-row span',
      '#contact-title', '.contact-note-item a'
    ];

    textSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        el.setAttribute('contenteditable', 'true');
        el.setAttribute('spellcheck', 'false');
        el.setAttribute('data-editable', 'text');
        el.addEventListener('input', () => {
          document.body.classList.add('has-unsaved-changes');
          this.hasUnsavedChanges = true;
          if (el.matches('.category-head h3')) {
            const categoryId = el.closest('[data-category]')?.dataset.category;
            const filterButton = Array.from(document.querySelectorAll('[data-filter]'))
              .find(button => button.dataset.filter === categoryId);
            const filterLabel = filterButton?.querySelector('.filter-text');
            if (filterLabel) filterLabel.textContent = el.textContent.trim();
            else if (filterButton) filterButton.textContent = el.textContent.trim();
          }
        });
        el.addEventListener('click', (e) => {
          if (el.tagName === 'A') e.preventDefault();
        });
        el.addEventListener('paste', (e) => {
          e.preventDefault();
          const text = (e.originalEvent || e).clipboardData.getData('text/plain');
          document.execCommand('insertText', false, text);
          document.body.classList.add('has-unsaved-changes');
          this.hasUnsavedChanges = true;
        });
      });
    });
  }

  setupMediaButtons() {
    if (this._mediaBtnsDone) return;
    this._mediaBtnsDone = true;

    // 0. Marcas (Brand Pills)
    document.querySelectorAll('.brands-grid .brand-pill').forEach((pill, index) => {
      if (pill.querySelector('.admin-edit-brand-btn')) return;
      pill.style.position = 'relative';

      const circle = pill.querySelector('.brand-pill-circle');
      const brandName = pill.getAttribute('title') || circle?.querySelector('.brand-name')?.textContent.trim() || `Marca #${index + 1}`;

      const btn = document.createElement('button');
      btn.className = 'admin-edit-brand-btn';
      btn.innerHTML = '✏';
      btn.title = `Trocar ícone/logo da marca ${brandName}`;
      btn.type = 'button';

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();

        const currentImg = circle?.querySelector('img.brand-logo-img')?.src || circle?.dataset?.customLogo || '';
        const currentId = circle?.dataset?.mediaId || '';
        const currentTitle = pill.getAttribute('title') || brandName;

        this.openMediaModal({
          title: `Editar Marca #${index + 1} (${currentTitle})`,
          type: 'brand',
          posterUrl: currentId || currentImg,
          label: currentTitle,
          onSave: (data) => {
            if (data.label) {
              pill.title = data.label;
            }
            if (data.posterUrl) {
              circle.classList.add('has-custom-logo');
              circle.dataset.customLogo = data.posterUrl;
              if (data.posterId) circle.dataset.mediaId = data.posterId;
              else delete circle.dataset.mediaId;

              let img = circle.querySelector('img.brand-logo-img');
              if (!img) {
                circle.innerHTML = `<img src="${data.posterUrl}" alt="${data.label || currentTitle}" class="brand-logo-img">`;
              } else {
                img.src = data.posterUrl;
                img.alt = data.label || currentTitle;
              }
            } else {
              circle.classList.remove('has-custom-logo');
              delete circle.dataset.customLogo;
              delete circle.dataset.mediaId;
              if (data.label) {
                circle.innerHTML = `<span class="brand-name">${data.label}</span>`;
              }
            }
          }
        });
      });
      pill.appendChild(btn);
    });

    // 1. Hero Video
    const heroFrame = document.querySelector('.hero-frame');
    if (heroFrame && !heroFrame.querySelector('.admin-edit-media-btn')) {
      const btn = document.createElement('button');
      btn.className = 'admin-edit-media-btn';
      btn.innerHTML = '✏ Editar Vídeo do Hero';
      btn.type = 'button';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const video = heroFrame.querySelector('video');
        const source = video?.querySelector('source');
        const currentVid = source?.dataset?.mediaId || (source ? source.src : (video ? video.src : ''));
        const currentPost = video?.dataset?.posterId || (video ? video.poster : '');
        this.openMediaModal({
          title: 'Editar Vídeo da Primeira Dobra (Hero)',
          type: 'hero',
          videoUrl: currentVid,
          posterUrl: currentPost,
          onSave: (data) => {
            const finalUrl = normalizeVideoUrl(data.videoUrl);
            if (source) {
              source.src = finalUrl;
              if (data.videoId) source.dataset.mediaId = data.videoId;
              else delete source.dataset.mediaId;
            }
            if (video) {
              video.src = finalUrl;
              if (data.posterUrl) video.poster = data.posterUrl;
              if (data.posterId) video.dataset.posterId = data.posterId;
              else delete video.dataset.posterId;
              video.load();
              const p = video.play();
              if (p !== undefined) {
                p.catch(() => {
                  video.muted = true;
                  video.play().catch(() => {});
                });
              }
            }
          }
        });
      });
      heroFrame.appendChild(btn);
    }

    // 2. Video Cards do Portfólio
    document.querySelectorAll('.video-card').forEach((card, index) => {
      if (card.querySelector('.admin-edit-media-btn')) return;

      const btn = document.createElement('button');
      btn.className = 'admin-edit-media-btn';
      btn.innerHTML = '✏ Editar Vídeo';
      btn.type = 'button';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const video = card.querySelector('video');
        const source = video?.querySelector('source');
        const metaSpan = card.querySelector('.video-meta span:first-child');
        const currentVid = source?.dataset?.mediaId || (source ? source.src : (video ? video.src : ''));
        const currentPost = video?.dataset?.posterId || (video ? video.poster : '');

        this.openMediaModal({
          title: `Editar Vídeo do Card #${index + 1}`,
          type: 'video',
          videoUrl: currentVid,
          posterUrl: currentPost,
          label: metaSpan ? metaSpan.textContent.trim() : '',
          onSave: (data) => {
            const finalUrl = normalizeVideoUrl(data.videoUrl);
            const isSocialUrl = finalUrl.includes('instagram.com') || finalUrl.includes('tiktok.com');
            if (isSocialUrl) {
              card.dataset.externalUrl = finalUrl;
            } else {
              delete card.dataset.externalUrl;
              if (source) {
                source.src = finalUrl;
                if (data.videoId) source.dataset.mediaId = data.videoId;
                else delete source.dataset.mediaId;
              }
              if (video) {
                video.src = finalUrl;
                video.load();
              }
            }
            if (video && data.posterUrl) {
              video.poster = data.posterUrl;
              if (data.posterId) video.dataset.posterId = data.posterId;
              else delete video.dataset.posterId;
            }
            if (metaSpan && data.label) {
              metaSpan.textContent = data.label;
            }
          }
        });
      });
      card.appendChild(btn);
    });

    // 3. Imagem da Kelly (Sobre)
    const aboutImageWrap = document.querySelector('.about-image');
    if (aboutImageWrap && !aboutImageWrap.querySelector('.admin-edit-media-btn')) {
      const btn = document.createElement('button');
      btn.className = 'admin-edit-media-btn';
      btn.innerHTML = '✏ Trocar Foto';
      btn.type = 'button';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const img = aboutImageWrap.querySelector('img');
        this.openMediaModal({
          title: 'Trocar Foto da Kelly (Seção Sobre)',
          type: 'image',
          posterUrl: img?.dataset?.mediaId || (img ? img.src : ''),
          onSave: (data) => {
            if (img && data.posterUrl) {
              img.src = data.posterUrl;
              if (data.posterId) img.dataset.mediaId = data.posterId;
              else delete img.dataset.mediaId;
            }
          }
        });
      });
      aboutImageWrap.appendChild(btn);
    }

    // 4. Cases Reais ("Cases que saem da tela.")
    document.querySelectorAll('.real-case').forEach((caseEl, index) => {
      if (caseEl.querySelector('.admin-edit-media-btn')) return;
      caseEl.style.position = 'relative';

      // Impede que o clique no link leve ao Instagram enquanto edita
      caseEl.addEventListener('click', (e) => {
        if (!e.target.closest('.admin-edit-media-btn')) {
          e.preventDefault();
        }
      });

      const btn = document.createElement('button');
      btn.className = 'admin-edit-media-btn';
      btn.innerHTML = '✏ Editar Capa e Link';
      btn.type = 'button';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();

        const cover = caseEl.querySelector('.real-case-cover');
        let currentCover = caseEl.dataset.coverUrl || '';
        if (!currentCover && cover) {
          const match = cover.style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
          if (match) currentCover = match[1];
        }
        const currentLink = caseEl.getAttribute('href') || '';
        const currentTag = caseEl.querySelector('.real-case-content span')?.textContent.trim() || '';

        this.openMediaModal({
          title: `Editar Case #${index + 1} ("Cases que saem da tela")`,
          type: 'case',
          posterUrl: caseEl.dataset.coverId || currentCover,
          linkUrl: currentLink,
          label: currentTag,
          onSave: (data) => {
            if (cover && data.posterUrl) {
              cover.style.backgroundImage = `url("${data.posterUrl}")`;
              caseEl.dataset.coverUrl = data.posterUrl;
              if (data.posterId) caseEl.dataset.coverId = data.posterId;
              else delete caseEl.dataset.coverId;
            }
            if (data.linkUrl) {
              caseEl.href = data.linkUrl;
            }
            const tagEl = caseEl.querySelector('.real-case-content span');
            if (tagEl && data.label) {
              tagEl.textContent = data.label;
            }
          }
        });
      });
      caseEl.appendChild(btn);
    });

    // 5. Últimos Posts do Instagram ("O que está no ar agora.")
    document.querySelectorAll('.photo-card').forEach((photoEl, index) => {
      if (photoEl.querySelector('.admin-edit-media-btn')) return;
      photoEl.style.position = 'relative';

      photoEl.addEventListener('click', (e) => {
        if (!e.target.closest('.admin-edit-media-btn')) {
          e.preventDefault();
        }
      });

      const btn = document.createElement('button');
      btn.className = 'admin-edit-media-btn';
      btn.innerHTML = '✏ Trocar Foto e Link';
      btn.type = 'button';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();

        const img = photoEl.querySelector('img');
        const span = photoEl.querySelector('span');
        const currentImg = img?.dataset?.mediaId || (img ? img.src : '');
        const currentLink = photoEl.getAttribute('href') || '';
        const currentLabel = span ? span.innerText.replace('↗', '').trim() : '';

        this.openMediaModal({
          title: `Editar Post #${index + 1} ("O que está no ar agora")`,
          type: 'instagram',
          posterUrl: currentImg,
          linkUrl: currentLink,
          label: currentLabel,
          onSave: (data) => {
            if (img && data.posterUrl) {
              img.src = data.posterUrl;
              if (data.posterId) img.dataset.mediaId = data.posterId;
              else delete img.dataset.mediaId;
            }
            if (data.linkUrl) {
              photoEl.href = data.linkUrl;
            }
            if (span && data.label) {
              span.innerHTML = `${data.label} <b>&#8599;</b>`;
            }
          }
        });
      });
      photoEl.appendChild(btn);
    });
  }

  setupToolbar() {
    if (this._toolbarDone) return;
    this._toolbarDone = true;

    const saveBtn = document.getElementById('admin-save-btn');
    const resetBtn = document.getElementById('admin-reset-btn');
    const logoutBtn = document.getElementById('admin-logout-btn');

    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveAllChanges());
    }

    const viewBtn = document.querySelector('.admin-btn-view');
    if (viewBtn) {
      viewBtn.addEventListener('click', () => {
        this.saveAllChanges();
      });
    }

    const doReset = async () => {
      if (!confirm('Descartar as alterações pendentes e recarregar a versão publicada online?')) return;
      if (this.isSaving || !window.kmCMS) return;

      try {
        const response = await fetch(`content.json?_t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`GitHub Pages respondeu ${response.status}.`);
        const published = await response.json();
        if (!published || !published.updatedAt) throw new Error('O conteúdo publicado não é válido.');

        window.kmCMS.data = deepMerge(defaultCMSContent, published);
        if (!window.kmCMS.saveContent(published)) throw new Error('Não foi possível atualizar o cache deste dispositivo.');
        await window.kmCMS.applyToPage();
        this.hasUnsavedChanges = false;
        document.body.classList.remove('has-unsaved-changes');
        this.showToast('Versão publicada online carregada neste dispositivo.');
      } catch (error) {
        this.showToast(`Não foi possível carregar a versão online: ${error.message}`, 'error');
      }
    };

    const doLogout = () => {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      location.reload();
    };

    if (resetBtn) resetBtn.addEventListener('click', doReset);
    if (logoutBtn) logoutBtn.addEventListener('click', doLogout);

    // ── MOBILE: Drawer de ações ──────────────────────────────────────
    const mobileMenuBtn = document.getElementById('admin-mobile-menu-btn');
    const drawer = document.getElementById('admin-mobile-drawer');
    const drawerOverlay = document.getElementById('admin-mobile-drawer-overlay');

    const openDrawer = () => {
      if (!drawer) return;
      drawerOverlay?.style.setProperty('display', 'block');
      requestAnimationFrame(() => {
        drawer.classList.add('is-open');
        drawerOverlay?.classList.add('is-open');
        mobileMenuBtn?.classList.add('is-active');
      });
    };

    const closeDrawer = () => {
      if (!drawer) return;
      drawer.classList.remove('is-open');
      drawerOverlay?.classList.remove('is-open');
      mobileMenuBtn?.classList.remove('is-active');
      setTimeout(() => {
        if (!drawer.classList.contains('is-open')) {
          drawerOverlay?.style.removeProperty('display');
        }
      }, 350);
    };

    mobileMenuBtn?.addEventListener('click', () => {
      drawer?.classList.contains('is-open') ? closeDrawer() : openDrawer();
    });

    drawerOverlay?.addEventListener('click', closeDrawer);

    // Botões dentro do drawer — delegam às mesmas ações do desktop
    document.getElementById('admin-save-btn-mobile')?.addEventListener('click', () => {
      closeDrawer();
      this.saveAllChanges();
    });

    document.getElementById('admin-gh-config-btn-mobile')?.addEventListener('click', () => {
      closeDrawer();
      document.getElementById('admin-gh-config-btn')?.click();
    });

    document.getElementById('admin-export-btn-mobile')?.addEventListener('click', () => {
      closeDrawer();
      document.getElementById('admin-export-btn')?.click();
    });

    document.getElementById('admin-import-btn-mobile')?.addEventListener('click', () => {
      closeDrawer();
      document.getElementById('admin-import-btn')?.click();
    });

    document.getElementById('admin-reset-btn-mobile')?.addEventListener('click', () => {
      closeDrawer();
      setTimeout(doReset, 200); // Espera o drawer fechar antes do confirm()
    });

    document.getElementById('admin-logout-btn-mobile')?.addEventListener('click', () => {
      closeDrawer();
      setTimeout(doLogout, 200);
    });

    // FAB de salvar (sempre visível em mobile)
    document.getElementById('admin-fab-save-btn')?.addEventListener('click', () => {
      this.saveAllChanges();
    });

    // Botão de conexão no banner de alerta
    document.getElementById('admin-gh-warning-connect-btn')?.addEventListener('click', () => {
      document.getElementById('admin-gh-config-btn')?.click();
    });
  }


  setupMediaModal() {
    if (!this.mediaModal || this._mediaModalDone) return;
    this._mediaModalDone = true;

    const feedbackEl = document.getElementById('admin-video-url-feedback');
    const videoUrlInput = document.getElementById('admin-modal-video-url');

    const updateVideoFeedback = () => {
      if (!feedbackEl || !videoUrlInput) return;
      const val = videoUrlInput.value.trim();
      if (!val) {
        feedbackEl.className = 'admin-url-feedback is-hidden';
        feedbackEl.textContent = '';
        return;
      }

      const normalized = normalizeVideoUrl(val);
      if (normalized !== val) {
        videoUrlInput.value = normalized;
        feedbackEl.className = 'admin-url-feedback info';
        feedbackEl.textContent = '✓ Link de nuvem (Google Drive / Dropbox) ajustado automaticamente para streaming direto!';
        return;
      }

      if (val.includes('instagram.com/reel') || val.includes('instagram.com/p')) {
        feedbackEl.className = 'admin-url-feedback warn';
        feedbackEl.textContent = 'ℹ️ Link de post do Instagram detectado: o card abrirá o Reel ao ser clicado. Para reproduzir o vídeo diretamente na página, envie o arquivo MP4 na aba "📁 Subir do PC".';
        return;
      }

      if (val.includes('tiktok.com')) {
        feedbackEl.className = 'admin-url-feedback warn';
        feedbackEl.textContent = 'ℹ️ Link do TikTok detectado: o card abrirá o TikTok ao ser clicado. Para reproduzir o vídeo diretamente na página, envie o arquivo MP4 na aba "📁 Subir do PC".';
        return;
      }

      if (val.match(/\.(mp4|webm|mov|m4v)(\?.*)?$/i) || val.includes('cloudinary') || val.includes('storage.googleapis') || val.includes('amazonaws')) {
        feedbackEl.className = 'admin-url-feedback success';
        feedbackEl.textContent = '✓ Link direto de vídeo reconhecido (.mp4 / streaming)';
        return;
      }

      feedbackEl.className = 'admin-url-feedback info';
      feedbackEl.textContent = '▶️ Link inserido. Certifique-se de que o arquivo é público e acessível.';
    };

    videoUrlInput?.addEventListener('input', updateVideoFeedback);
    videoUrlInput?.addEventListener('change', updateVideoFeedback);
    this.updateVideoFeedback = updateVideoFeedback;

    const closeModal = () => {
      this.mediaModal.classList.remove('is-open');
      this.currentEditingMedia = null;
      this.selectedVideoFile = null;
      this.selectedPosterFile = null;
      this.videoDropzoneCtrl?.reset();
      this.posterDropzoneCtrl?.reset();
      if (feedbackEl) {
        feedbackEl.className = 'admin-url-feedback is-hidden';
        feedbackEl.textContent = '';
      }
    };

    const closeBtn = this.mediaModal.querySelector('.admin-modal-close');
    const cancelBtn = document.getElementById('admin-modal-cancel');
    const saveBtn = document.getElementById('admin-modal-save');

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    this.mediaModal.addEventListener('click', (e) => {
      if (e.target === this.mediaModal) closeModal();
    });

    // Abas (Link vs Subir do PC)
    const tabButtons = this.mediaModal.querySelectorAll('.admin-tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const group = btn.closest('.admin-modal-group');
        if (!group) return;
        const tabName = btn.dataset.tab; // 'url' ou 'file'
        group.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');

        group.querySelectorAll('.admin-tab-content').forEach(c => {
          c.classList.remove('is-active');
          if (c.dataset.tabContent && c.dataset.tabContent.endsWith(tabName)) {
            c.classList.add('is-active');
          }
        });
      });
    });

    // Configuração do Dropzone de Vídeo
    this.videoDropzoneCtrl = this.initDropzone({
      dropzoneId: 'video-dropzone',
      fileInputId: 'admin-modal-video-file',
      emptyId: 'video-dropzone-empty',
      selectedId: 'video-dropzone-selected',
      nameId: 'video-file-name',
      removeId: 'video-file-remove',
      onSelect: (file) => {
        this.selectedVideoFile = file;
      },
      onRemove: () => {
        this.selectedVideoFile = null;
      }
    });

    // Configuração do Dropzone de Imagem/Poster
    this.posterDropzoneCtrl = this.initDropzone({
      dropzoneId: 'poster-dropzone',
      fileInputId: 'admin-modal-poster-file',
      emptyId: 'poster-dropzone-empty',
      selectedId: 'poster-dropzone-selected',
      nameId: 'poster-file-name',
      removeId: 'poster-file-remove',
      onSelect: (file) => {
        this.selectedPosterFile = file;
      },
      onRemove: () => {
        this.selectedPosterFile = null;
      }
    });

    if (saveBtn) {
      saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!this.currentEditingMedia) return;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Processando...';

        // Helper: exibe mensagem de progresso na área de nome do arquivo no dropzone
        const setProgress = (dropzoneNameId, msg) => {
          const el = document.getElementById(dropzoneNameId);
          if (el) el.textContent = msg;
        };

        try {
          const videoGroup = document.getElementById('admin-modal-video-group');
          const posterGroup = document.getElementById('admin-modal-poster-group');
          const isVideoFileTab = videoGroup?.querySelector('.admin-tab-btn[data-tab="file"]')?.classList.contains('is-active');
          const isPosterFileTab = posterGroup?.querySelector('.admin-tab-btn[data-tab="file"]')?.classList.contains('is-active');

          const cfg = getGitHubConfig();
          const hasGhToken = cfg && cfg.token && !cfg.token.includes('*');

          // Validação mandatória: impede upload de mídias locais sem token do GitHub
          if ((isVideoFileTab && this.selectedVideoFile) || (isPosterFileTab && this.selectedPosterFile)) {
            if (!hasGhToken) {
              saveBtn.disabled = false;
              saveBtn.textContent = 'Aplicar';
              alert('⛔ Conexão com o GitHub Obrigatória:\n\nPara que o arquivo suba para o site oficial e fique visível para outros visitantes em qualquer aparelho, este dispositivo precisa estar conectado ao GitHub.\n\nPor favor, conecte o Token do GitHub agora para habilitar o envio.');
              document.getElementById('admin-github-modal')?.classList.remove('is-hidden');
              document.getElementById('admin-github-modal')?.classList.add('is-open');
              return;
            }
          }

          let rawVideoUrl = document.getElementById('admin-modal-video-url')?.value.trim() || '';
          let finalVideoUrl = normalizeVideoUrl(rawVideoUrl);
          let finalVideoId = null;

          if (isVideoFileTab && this.selectedVideoFile) {
            try {
              saveBtn.textContent = 'Enviando vídeo para o GitHub...';
              const ghUrl = await uploadFileToGitHub(
                this.selectedVideoFile,
                (msg) => setProgress('video-file-name', msg)
              );
              if (ghUrl) {
                finalVideoUrl = ghUrl;
                finalVideoId = null;
                if (this.currentEditingMedia.currentVideoId) {
                  await kmMediaStore.deleteMedia(this.currentEditingMedia.currentVideoId).catch(() => {});
                }
              }
            } catch (uploadErr) {
              console.error('Erro no upload do vídeo para GitHub:', uploadErr);
              saveBtn.disabled = false;
              saveBtn.textContent = 'Aplicar';
              alert(`❌ Falha no envio do vídeo para o GitHub:\n\n${uploadErr.message}`);
              return;
            }
          } else if (isVideoFileTab && this.currentEditingMedia.currentVideoId && !finalVideoUrl) {
            finalVideoId = this.currentEditingMedia.currentVideoId;
            finalVideoUrl = await kmMediaStore.resolveUrl(finalVideoId);
          } else if (!isVideoFileTab && rawVideoUrl && this.currentEditingMedia.currentVideoId) {
            await kmMediaStore.deleteMedia(this.currentEditingMedia.currentVideoId).catch(() => {});
            finalVideoId = null;
          } else if (!isVideoFileTab) {
            finalVideoId = null;
          }

          let rawPosterUrl = document.getElementById('admin-modal-poster-url')?.value.trim() || '';
          let finalPosterUrl = normalizeImageUrl(rawPosterUrl);
          let finalPosterId = null;

          if (isPosterFileTab && this.selectedPosterFile) {
            try {
              saveBtn.textContent = 'Enviando imagem (WebP)...';
              const ghUrl = await uploadFileToGitHub(
                this.selectedPosterFile,
                (msg) => setProgress('poster-file-name', msg)
              );
              if (ghUrl) {
                finalPosterUrl = ghUrl;
                finalPosterId = null;
                if (this.currentEditingMedia.currentPosterId) {
                  await kmMediaStore.deleteMedia(this.currentEditingMedia.currentPosterId).catch(() => {});
                }
              }
            } catch (uploadErr) {
              console.error('Erro no upload da imagem para GitHub:', uploadErr);
              saveBtn.disabled = false;
              saveBtn.textContent = 'Aplicar';
              alert(`❌ Falha no envio da imagem para o GitHub:\n\n${uploadErr.message}`);
              return;
            }
          } else if (isPosterFileTab && this.currentEditingMedia.currentPosterId && !finalPosterUrl) {
            finalPosterId = this.currentEditingMedia.currentPosterId;
            finalPosterUrl = await kmMediaStore.resolveUrl(finalPosterId);
          } else if (!isPosterFileTab && rawPosterUrl && this.currentEditingMedia.currentPosterId) {
            await kmMediaStore.deleteMedia(this.currentEditingMedia.currentPosterId).catch(() => {});
            finalPosterId = null;
          } else if (!isPosterFileTab) {
            finalPosterId = null;
          }

          const label = document.getElementById('admin-modal-label')?.value.trim();
          const linkUrl = document.getElementById('admin-modal-link-url')?.value.trim();

          if (this.currentEditingMedia.onSave) {
            this.currentEditingMedia.onSave({
              videoUrl: finalVideoUrl,
              videoId: finalVideoId,
              posterUrl: finalPosterUrl,
              posterId: finalPosterId,
              label,
              linkUrl
            });
          }

          document.body.classList.add('has-unsaved-changes');
          this.hasUnsavedChanges = true;
          closeModal();
          this.showToast('✓ Mídia aplicada no card! Clique em "💾 Salvar e Publicar" no topo para colocar no ar.');
        } catch (err) {
          console.error('Erro ao processar mídia:', err);
          alert('Houve um erro ao processar a mídia. Tente novamente.');
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Aplicar';
        }
      });
    }
  }

  initDropzone({ dropzoneId, fileInputId, emptyId, selectedId, nameId, removeId, onSelect, onRemove }) {
    const dropzone = document.getElementById(dropzoneId);
    const fileInput = document.getElementById(fileInputId);
    const emptyEl = document.getElementById(emptyId);
    const selectedEl = document.getElementById(selectedId);
    const nameEl = document.getElementById(nameId);
    const removeBtn = document.getElementById(removeId);

    if (!dropzone || !fileInput) return null;

    dropzone.addEventListener('click', (e) => {
      if (e.target !== fileInput && !e.target.closest('.file-remove-btn')) {
        fileInput.click();
      }
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('is-dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('is-dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        fileInput.files = files;
        handleFile(files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        handleFile(fileInput.files[0]);
      }
    });

    const handleFile = async (file) => {
      if (!file) return;
      if (emptyEl) emptyEl.classList.add('is-hidden');
      if (selectedEl) selectedEl.classList.remove('is-hidden');

      const imageMimeType = getImageMimeType(file);
      if (imageMimeType && imageMimeType !== 'image/svg+xml' && imageMimeType !== 'image/webp') {
        if (nameEl) nameEl.textContent = `${file.name} (Convertendo para WebP...)`;
        try {
          const webpRes = await convertImageToWebp(file);
          if (webpRes && webpRes.file) {
            file = webpRes.file;
            const savings = Math.max(0, Math.round((1 - (webpRes.newSize / (webpRes.originalSize || 1))) * 100));
            if (nameEl) {
              nameEl.textContent = `${file.name} (${formatFileSize(webpRes.newSize)} · WebP -${savings}%)`;
            }
          }
        } catch (err) {
          console.warn('Erro ao otimizar para WebP:', err);
          if (nameEl) nameEl.textContent = `${file.name} (${formatFileSize(file.size)})`;
        }
      } else {
        if (nameEl) nameEl.textContent = `${file.name} (${formatFileSize(file.size)})`;
      }
      if (onSelect) onSelect(file);
    };

    const reset = () => {
      fileInput.value = '';
      if (nameEl) nameEl.textContent = '';
      if (emptyEl) emptyEl.classList.remove('is-hidden');
      if (selectedEl) selectedEl.classList.add('is-hidden');
      if (onRemove) onRemove();
    };

    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        reset();
      });
    }

    return {
      reset,
      setDisplay: (text) => {
        if (nameEl) nameEl.textContent = text;
        if (emptyEl) emptyEl.classList.add('is-hidden');
        if (selectedEl) selectedEl.classList.remove('is-hidden');
      }
    };
  }

  openMediaModal({ title, type, videoUrl = '', posterUrl = '', label = '', linkUrl = '', onSave }) {
    if (!this.mediaModal) return;

    this.selectedVideoFile = null;
    this.selectedPosterFile = null;
    this.videoDropzoneCtrl?.reset();
    this.posterDropzoneCtrl?.reset();

    const currentVideoId = (typeof videoUrl === 'string' && videoUrl.startsWith('idb:')) ? videoUrl : null;
    const currentPosterId = (typeof posterUrl === 'string' && posterUrl.startsWith('idb:')) ? posterUrl : null;

    this.currentEditingMedia = { type, currentVideoId, currentPosterId, onSave };

    const modalTitle = document.getElementById('admin-modal-title');
    const videoGroup = document.getElementById('admin-modal-video-group');
    const labelGroup = document.getElementById('admin-modal-label-group');
    const linkGroup = document.getElementById('admin-modal-link-group');

    const videoInput = document.getElementById('admin-modal-video-url');
    const posterInput = document.getElementById('admin-modal-poster-url');
    const labelInput = document.getElementById('admin-modal-label');
    const linkInput = document.getElementById('admin-modal-link-url');

    if (modalTitle) modalTitle.textContent = title || 'Editar Mídia';
    if (labelInput) labelInput.value = label;
    if (linkInput) linkInput.value = linkUrl;

    // Configura aba do Vídeo
    if (videoGroup) {
      const vidBtnUrl = videoGroup.querySelector('.admin-tab-btn[data-tab="url"]');
      const vidBtnFile = videoGroup.querySelector('.admin-tab-btn[data-tab="file"]');
      const vidContentUrl = videoGroup.querySelector('.admin-tab-content[data-tab-content="video-url"]');
      const vidContentFile = videoGroup.querySelector('.admin-tab-content[data-tab-content="video-file"]');

      if (currentVideoId) {
        if (videoInput) videoInput.value = '';
        vidBtnUrl?.classList.remove('is-active');
        vidBtnFile?.classList.add('is-active');
        vidContentUrl?.classList.remove('is-active');
        vidContentFile?.classList.add('is-active');
        this.videoDropzoneCtrl?.setDisplay('Vídeo do PC salvo no banco');
      } else {
        if (videoInput) videoInput.value = videoUrl || '';
        vidBtnUrl?.classList.add('is-active');
        vidBtnFile?.classList.remove('is-active');
        vidContentUrl?.classList.add('is-active');
        vidContentFile?.classList.remove('is-active');
      }
    }

    // Configura aba do Poster / Foto
    const posterGroup = document.getElementById('admin-modal-poster-group');
    if (posterGroup) {
      const posBtnUrl = posterGroup.querySelector('.admin-tab-btn[data-tab="url"]');
      const posBtnFile = posterGroup.querySelector('.admin-tab-btn[data-tab="file"]');
      const posContentUrl = posterGroup.querySelector('.admin-tab-content[data-tab-content="poster-url"]');
      const posContentFile = posterGroup.querySelector('.admin-tab-content[data-tab-content="poster-file"]');

      if (currentPosterId) {
        if (posterInput) posterInput.value = '';
        posBtnUrl?.classList.remove('is-active');
        posBtnFile?.classList.add('is-active');
        posContentUrl?.classList.remove('is-active');
        posContentFile?.classList.add('is-active');
        this.posterDropzoneCtrl?.setDisplay('Imagem do PC salva');
      } else if (posterUrl && posterUrl.startsWith('data:image/')) {
        if (posterInput) posterInput.value = '';
        posBtnUrl?.classList.remove('is-active');
        posBtnFile?.classList.add('is-active');
        posContentUrl?.classList.remove('is-active');
        posContentFile?.classList.add('is-active');
        this.posterDropzoneCtrl?.setDisplay('Foto do PC carregada');
      } else {
        if (posterInput) posterInput.value = posterUrl || '';
        posBtnUrl?.classList.add('is-active');
        posBtnFile?.classList.remove('is-active');
        posContentUrl?.classList.add('is-active');
        posContentFile?.classList.remove('is-active');
      }
    }

    // Ajusta rótulos dos campos dinamicamente conforme o tipo
    const posterLabel = document.getElementById('admin-modal-poster-label');
    const labelGroupLabel = labelGroup ? labelGroup.querySelector('label') : null;

    if (type === 'brand') {
      if (posterLabel) posterLabel.textContent = 'Ícone / Logo da Marca (PNG, SVG, JPG)';
      if (labelGroupLabel) labelGroupLabel.textContent = 'Nome da Marca';
    } else {
      if (posterLabel) posterLabel.textContent = 'Imagem de Capa / Foto';
      if (labelGroupLabel) labelGroupLabel.textContent = 'Rótulo / Legenda do Card';
    }

    // Ajusta visibilidade de grupos conforme o tipo de mídia
    if (type === 'brand') {
      if (videoGroup) videoGroup.style.display = 'none';
      if (linkGroup) linkGroup.style.display = 'none';
      if (labelGroup) labelGroup.style.display = 'block';
    } else if (type === 'case' || type === 'instagram') {
      if (videoGroup) videoGroup.style.display = 'none';
      if (linkGroup) linkGroup.style.display = 'block';
      if (labelGroup) labelGroup.style.display = 'block';
    } else if (type === 'image') {
      if (videoGroup) videoGroup.style.display = 'none';
      if (linkGroup) linkGroup.style.display = 'none';
      if (labelGroup) labelGroup.style.display = 'none';
    } else {
      if (videoGroup) videoGroup.style.display = 'block';
      if (linkGroup) linkGroup.style.display = 'none';
      if (labelGroup) labelGroup.style.display = type === 'video' ? 'block' : 'none';
    }

    this.updateVideoFeedback?.();

    // Atualiza badge de status do token antes de abrir o modal
    const ghStatusBadge = document.getElementById('admin-modal-gh-status');
    if (ghStatusBadge) {
      const cfg = getGitHubConfig();
      if (cfg && cfg.token) {
        ghStatusBadge.innerHTML = `
          <div class="admin-gh-token-badge is-connected">
            <span class="badge-dot"></span>
            GitHub conectado &mdash; arquivos serão publicados e acessíveis em qualquer dispositivo
          </div>`;
      } else {
        ghStatusBadge.innerHTML = `
          <div class="admin-gh-token-badge is-disconnected">
            <span class="badge-dot"></span>
            Sem token GitHub &mdash; arquivos só aparecem neste dispositivo
            <button type="button" class="badge-action" id="badge-gh-config-link">Configurar agora</button>
          </div>`;
        const configLink = ghStatusBadge.querySelector('#badge-gh-config-link');
        if (configLink) {
          configLink.addEventListener('click', () => {
            document.getElementById('admin-gh-config-btn')?.click();
          });
        }
      }
    }

    this.mediaModal.classList.add('is-open');
  }

  extractCurrentContent() {
    // 1. Extrai todos os dados atuais do DOM
    const heroEyebrow = document.querySelector('.hero-copy .eyebrow')?.innerText.replace('✦', '').trim();
    const heroTitle = document.querySelector('#hero-title')?.innerHTML.trim();
    const heroText = document.querySelector('.hero-text')?.innerHTML.trim();
    const heroSticker = document.querySelector('.hero-sticker')?.innerHTML.trim();

    const heroVideo = document.querySelector('.hero-frame video');
    const heroSource = heroVideo?.querySelector('source');
    const heroVideoVal = getPortableMediaVal(heroSource?.src || heroVideo?.src, heroSource?.dataset?.mediaId || heroVideo?.dataset?.mediaId);
    const heroPosterVal = getPortableMediaVal(heroVideo?.poster, heroVideo?.dataset?.posterId);

    const brandsTitle = document.querySelector('#brands-title')?.innerHTML.trim();

    // Marcas (Brand Pills)
    const brandsList = [];
    document.querySelectorAll('.brands-grid .brand-pill').forEach((pill) => {
      const circle = pill.querySelector('.brand-pill-circle');
      const img = circle?.querySelector('img.brand-logo-img');
      const rawImgSrc = circle?.dataset?.customLogo || img?.src || '';
      const imageVal = getPortableMediaVal(rawImgSrc, circle?.dataset?.mediaId);
      const nameVal = pill.getAttribute('title') || circle?.querySelector('.brand-name')?.textContent.trim() || '';

      brandsList.push({
        name: nameVal,
        image: normalizeImageUrl(imageVal)
      });
    });

    const portfolioTitle = document.querySelector('#portfolio-title')?.innerHTML.trim();
    const portfolioIntro = document.querySelector('.portfolio .section-intro')?.innerHTML.trim();
    const categories = Array.from(document.querySelectorAll('.category-block')).map((block) => ({
      id: block.dataset.category || '',
      name: block.querySelector('.category-head h3')?.textContent.trim() || '',
      description: block.querySelector('.category-head p')?.textContent.trim() || ''
    })).filter(category => category.id);

    // 30 Vídeos
    const portfolioVideos = [];
    document.querySelectorAll('.video-card').forEach((card) => {
      const video = card.querySelector('video');
      const source = video?.querySelector('source');
      const label = card.querySelector('.video-meta span:first-child')?.textContent.trim();
      const rawVid = card.dataset.externalUrl || source?.src || video?.src || '';
      const videoVal = getPortableMediaVal(rawVid, source?.dataset?.mediaId || video?.dataset?.mediaId);
      const posterVal = getPortableMediaVal(video?.poster, video?.dataset?.posterId);

      portfolioVideos.push({
        video: videoVal,
        poster: normalizeImageUrl(posterVal),
        label: label || ''
      });
    });

    // Cases Reais ("Cases que saem da tela.")
    const realCases = [];
    document.querySelectorAll('.real-case').forEach((caseEl) => {
      const cover = caseEl.querySelector('.real-case-cover');
      let bgUrl = caseEl.dataset.coverUrl || '';
      if (!bgUrl && cover) {
        const match = cover.style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
        if (match) bgUrl = match[1];
      }
      const coverVal = getPortableMediaVal(bgUrl, caseEl.dataset.coverId);
      const tag = caseEl.querySelector('.real-case-content span')?.innerHTML.trim();
      const title = caseEl.querySelector('.real-case-content h3')?.innerHTML.trim();
      const desc = caseEl.querySelector('.real-case-content p')?.innerHTML.trim();

      realCases.push({
        cover: normalizeImageUrl(coverVal),
        link: caseEl.getAttribute('href') || '',
        tag: tag || '',
        title: title || '',
        desc: desc || ''
      });
    });

    // Últimos Posts do Instagram ("O que está no ar agora.")
    const instagramPosts = [];
    document.querySelectorAll('.photo-card').forEach((card) => {
      const img = card.querySelector('img');
      const span = card.querySelector('span');
      const label = span ? span.innerText.replace('↗', '').trim() : '';
      const imgVal = getPortableMediaVal(img?.src, img?.dataset?.mediaId);

      instagramPosts.push({
        image: normalizeImageUrl(imgVal),
        link: card.getAttribute('href') || '',
        label: label || ''
      });
    });

    // Sobre
    const aboutTitle = document.querySelector('#about-title')?.innerHTML.trim();
    const aboutBio = document.querySelector('.about-content p:nth-of-type(2)')?.innerHTML.trim();
    const aboutImgEl = document.querySelector('.about-image img');
    const aboutImageVal = getPortableMediaVal(aboutImgEl?.src, aboutImgEl?.dataset?.mediaId);

    // Serviços & Formatos
    const servicesTitle = document.querySelector('#services-title')?.innerHTML.trim();
    const servicesList = [];
    document.querySelectorAll('.service-card').forEach((card) => {
      servicesList.push({
        title: card.querySelector('h3')?.innerHTML.trim() || '',
        text: card.querySelector('p')?.innerHTML.trim() || ''
      });
    });

    // Contato
    const contactTitle = document.querySelector('#contact-title')?.innerHTML.trim();
    const contactEmail = document.querySelector('a[href^="mailto:"]')?.textContent.trim();
    const contactWa = document.querySelector('a[href*="wa.me"]')?.textContent.trim();
    const contactWaLink = document.querySelector('a[href*="wa.me"]')?.getAttribute('href');

    return {
      updatedAt: new Date().toISOString(),
      hero: {
        eyebrow: heroEyebrow,
        title: heroTitle,
        text: heroText,
        sticker: heroSticker,
        video: heroVideoVal,
        poster: normalizeImageUrl(heroPosterVal)
      },
      brandsTitle,
      brandsList,
      portfolioTitle,
      portfolioIntro,
      categories,
      portfolioVideos,
      realCases,
      instagramPosts,
      servicesTitle,
      servicesList,
      about: {
        title: aboutTitle,
        bio: aboutBio,
        image: normalizeImageUrl(aboutImageVal)
      },
      contact: {
        title: contactTitle,
        email: contactEmail,
        whatsapp: contactWa,
        whatsappLink: contactWaLink
      }
    };
  }

  async publishToGitHub(contentToSave) {
    const cfg = getGitHubConfig();
    if (!cfg || !cfg.token || cfg.token.includes('*')) {
      return { ok: false, missingConfig: true };
    }
    try {
      const branch = cfg.branch || 'main';
      const categories = contentToSave.categories || defaultCMSContent.categories;
      const [remoteContentText, ...documentTexts] = await Promise.all([
        fetchGitHubTextFile(cfg, cfg.path || 'content.json', branch),
        ...['index.html', 'admin.html', 'llms.txt', 'sitemap.xml'].map(path => fetchGitHubTextFile(cfg, path, branch))
      ]);
      const remoteContent = JSON.parse(remoteContentText);
      const previousBrands = Array.isArray(remoteContent.brandsList) ? remoteContent.brandsList : [];
      const documentPaths = ['index.html', 'admin.html', 'llms.txt', 'sitemap.xml'];
      const documents = await Promise.all(documentPaths.map(async path => ({
        path,
        content: documentTexts[documentPaths.indexOf(path)]
      })));
      const original = Object.fromEntries(documents.map(file => [file.path, file.content]));
      const updated = [
        { path: 'index.html', content: updateCategoryHtml(original['index.html'], categories, contentToSave.brandsList || []) },
        { path: 'admin.html', content: updateCategoryHtml(original['admin.html'], categories, contentToSave.brandsList || []) },
        { path: 'llms.txt', content: updateLlmsBrands(updateLlmsCategories(original['llms.txt'], categories), contentToSave.brandsList || [], previousBrands) },
        { path: 'sitemap.xml', content: updateSitemapCategories(original['sitemap.xml'], categories, contentToSave.brandsList || []) }
      ].filter(file => file.content !== original[file.path]);

      const files = [
        { path: cfg.path || 'content.json', content: JSON.stringify(contentToSave, null, 2) },
        ...updated
      ];
      await commitFilesToGitHub(cfg, files);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        status: error.status || 0,
        message: error.message || 'Erro ao publicar no GitHub'
      };
    }
  }

  async saveAllChanges() {
    if (this.isSaving) return false;
    this.isSaving = true;

    const saveBtn = document.getElementById('admin-save-btn');
    const originalText = saveBtn ? saveBtn.innerHTML : '💾 Salvar e Publicar';
    if (saveBtn) {
      saveBtn.classList.add('is-loading');
      saveBtn.disabled = true;
      saveBtn.innerHTML = '⏳ Salvando e publicando...';
    }

    let published = false;
    try {
      const contentToSave = this.extractCurrentContent();
      contentToSave.updatedAt = new Date().toISOString();

      // A publicação é a gravação principal; nada é persistido localmente antes dela.
      const ghResult = await this.publishToGitHub(contentToSave);

      if (!ghResult.ok && ghResult.missingConfig) {
        this.showToast('⚠️ Não publicado. Conecte o GitHub para salvar estas alterações online.', 'warning');
        document.getElementById('admin-github-modal')?.classList.remove('is-hidden');
        document.getElementById('admin-github-modal')?.classList.add('is-open');
        return false;
      }
      if (!ghResult.ok) {
        console.warn('GitHub publish warning status:', ghResult.status, ghResult.message);
        if (ghResult.status === 401) {
          alert('Token do GitHub expirado ou inválido. Por favor, reconfigure seu token.');
          document.getElementById('admin-github-modal')?.classList.remove('is-hidden');
          document.getElementById('admin-github-modal')?.classList.add('is-open');
        } else if (ghResult.status === 404) {
          alert('Repositório não encontrado ou token sem permissão de escrita ("repo").');
          document.getElementById('admin-github-modal')?.classList.remove('is-hidden');
          document.getElementById('admin-github-modal')?.classList.add('is-open');
        } else if (ghResult.status === 409) {
          alert('Houve um conflito temporário de sincronização no GitHub (dois salvamentos simultâneos). Clique em "Salvar e Publicar" novamente para consolidar.');
        } else {
          alert(`Aviso ao publicar no GitHub (${ghResult.status}): ${ghResult.message || 'Verifique as permissões do token.'}`);
        }
        this.showToast('⚠️ Não publicado. As alterações continuam pendentes nesta tela.', 'error');
        return false;
      }

      published = true;
      document.body.classList.remove('has-unsaved-changes');
      this.hasUnsavedChanges = false;

      let localMirrorFailed = false;
      try {
        if (!kmCMS.saveContent(contentToSave)) localMirrorFailed = true;
      } catch (localErr) {
        localMirrorFailed = true;
        console.warn('Admin: falha ao atualizar o cache local após publicar:', localErr);
      }

      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        try {
          const diskRes = await fetch('/api/save-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(contentToSave)
          });
          if (!diskRes.ok) localMirrorFailed = true;
        } catch (diskErr) {
          localMirrorFailed = true;
          console.warn('Admin: aviso ao gravar content.json no disco local', diskErr);
        }
      }

      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({ type: 'CONTENT_UPDATED', data: contentToSave }, window.location.origin);
        } catch (_) {}
      }

      this.updateGitHubWarningBar();
      this.showToast(
        localMirrorFailed
          ? '✓ Publicado no GitHub; a cópia local deste dispositivo não foi atualizada.'
          : '🚀 Salvo no GitHub com sucesso! O site oficial já está atualizando.',
        localMirrorFailed ? 'warning' : 'success'
      );
      return true;
    } catch (err) {
      console.warn('GitHub publish error:', err);
      if (published) {
        this.showToast('✓ Publicado no GitHub; houve falha ao atualizar uma cópia local.', 'warning');
        return true;
      }
      this.showToast('⚠️ Não publicado. Nenhuma cópia local foi salva; tente novamente.', 'error');
      alert(`Falha ao publicar no GitHub: ${err.message}`);
      return false;
    } finally {
      this.isSaving = false;
      if (saveBtn) {
        saveBtn.classList.remove('is-loading');
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
      }
    }
  }

  setupGitHubSync() {
    if (this._ghSyncDone) return;
    this._ghSyncDone = true;

    const ghModal = document.getElementById('admin-github-modal');
    const ghConfigBtn = document.getElementById('admin-gh-config-btn');
    const ghModalClose = document.getElementById('admin-gh-modal-close');
    const ghPublishBtn = document.getElementById('admin-publish-gh-btn');
    const ghTokenInput = document.getElementById('admin-gh-token');
    const ghRepoInput = document.getElementById('admin-gh-repo');
    const ghBranchInput = document.getElementById('admin-gh-branch');
    const ghPathInput = document.getElementById('admin-gh-path');
    const ghStatusEl = document.getElementById('admin-gh-status');
    const ghTestBtn = document.getElementById('admin-gh-test-btn');
    const ghSaveConfigBtn = document.getElementById('admin-gh-save-config-btn');
    const ghTokenToggle = document.getElementById('admin-gh-token-toggle');

    const updateBtnState = () => {
      const cfg = getGitHubConfig();
      if (ghConfigBtn) {
        if (cfg && cfg.token) {
          ghConfigBtn.innerHTML = '🟢 GitHub Conectado';
          ghConfigBtn.title = 'GitHub conectado para upload direto na nuvem. Clique para alterar token.';
          ghConfigBtn.style.borderColor = 'var(--lime)';
        } else {
          ghConfigBtn.innerHTML = '⚙️ Conectar GitHub';
          ghConfigBtn.title = 'Configure seu Token do GitHub para subir alterações direto na nuvem.';
          ghConfigBtn.style.borderColor = '';
        }
      }
    };
    updateBtnState();

    // Se estiver rodando localmente, carrega as configuracoes locais de local-config.json
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      fetch('/api/github-config')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data && data.token) {
            saveGitHubConfig(data);
            updateBtnState();
          }
        })
        .catch(() => {});
    }

    const openModal = () => {
      const cfg = getGitHubConfig();
      if (ghTokenInput) ghTokenInput.value = cfg.token || '';
      if (ghRepoInput) ghRepoInput.value = cfg.repo || 'abreumarcelo1994/kmorais';
      if (ghBranchInput) ghBranchInput.value = cfg.branch || 'main';
      if (ghPathInput) ghPathInput.value = cfg.path || 'content.json';
      if (ghStatusEl) {
        ghStatusEl.className = 'admin-gh-status is-hidden';
        ghStatusEl.textContent = '';
      }
      ghModal?.classList.remove('is-hidden');
      ghModal?.classList.add('is-open');
    };

    const closeModal = () => {
      ghModal?.classList.remove('is-open');
      ghModal?.classList.add('is-hidden');
    };

    if (ghConfigBtn) ghConfigBtn.addEventListener('click', openModal);
    if (ghModalClose) ghModalClose.addEventListener('click', closeModal);
    if (ghModal) {
      ghModal.addEventListener('click', (e) => {
        if (e.target === ghModal) closeModal();
      });
    }

    if (ghTokenToggle && ghTokenInput) {
      ghTokenToggle.addEventListener('click', () => {
        if (ghTokenInput.type === 'password') {
          ghTokenInput.type = 'text';
          ghTokenToggle.textContent = '🔒';
        } else {
          ghTokenInput.type = 'password';
          ghTokenToggle.textContent = '👁';
        }
      });
    }

    // Salvar configuração
    if (ghSaveConfigBtn) {
      ghSaveConfigBtn.addEventListener('click', () => {
        const token = ghTokenInput?.value.trim() || '';
        const repo = ghRepoInput?.value.trim() || 'abreumarcelo1994/kmorais';
        const branch = ghBranchInput?.value.trim() || 'main';
        const path = ghPathInput?.value.trim() || 'content.json';

        if (!token) {
          alert('Por favor, informe o token de acesso do GitHub (PAT).');
          return;
        }

        if (token.includes('*')) {
          alert('Atenção: O token contém asteriscos (ghp_****). O GitHub oculta tokens antigos após a criação. Para obter o código real, clique em "Regenerate token" na página do GitHub.');
          return;
        }

        saveGitHubConfig({ token, repo, branch, path });
        updateBtnState();
        this.updateGitHubWarningBar();
        this.showToast('✓ Configuração do GitHub salva com sucesso!');
        closeModal();
      });
    }

    // Copiar Link de Ativação Direta para Outro Computador
    const ghShareBtn = document.getElementById('admin-gh-share-btn');
    if (ghShareBtn) {
      ghShareBtn.addEventListener('click', () => {
        const cfg = getGitHubConfig();
        if (!cfg || !cfg.token || cfg.token.includes('*')) {
          alert('Por favor, configure e salve um token válido neste computador primeiro antes de gerar o link de compartilhamento.');
          return;
        }
        const shareUrl = `${window.location.origin}/admin.html#setupToken=${encodeURIComponent(cfg.token)}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareUrl).then(() => {
            alert('✓ Link de ativação copiado com sucesso!\n\nEnvie este link para a outra pessoa (por exemplo, via WhatsApp). Ao abrir no navegador dela, o GitHub será ativado automaticamente sem ela precisar digitar token!');
          }).catch(() => {
            prompt('Copie o link abaixo e envie para a outra pessoa:', shareUrl);
          });
        } else {
          prompt('Copie o link abaixo e envie para a outra pessoa:', shareUrl);
        }
      });
    }

    // Testar Conexão
    if (ghTestBtn) {
      ghTestBtn.addEventListener('click', async () => {
        const token = ghTokenInput?.value.trim();
        const repo = ghRepoInput?.value.trim();

        if (!token) {
          if (ghStatusEl) {
            ghStatusEl.className = 'admin-gh-status is-error';
            ghStatusEl.textContent = '❌ Por favor, preencha o campo do Token antes de testar.';
          }
          return;
        }

        if (token.includes('*')) {
          if (ghStatusEl) {
            ghStatusEl.className = 'admin-gh-status is-error';
            ghStatusEl.textContent = '❌ O token inserido contém asteriscos (ghp_****). O GitHub oculta tokens antigos após a criação. Para obter o código real, clique em "Regenerate token" na página do GitHub.';
          }
          return;
        }

        if (ghStatusEl) {
          ghStatusEl.className = 'admin-gh-status is-loading';
          ghStatusEl.textContent = '⏳ Testando conexão com a API do GitHub...';
        }

        try {
          const res = await fetch(`https://api.github.com/repos/${repo}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28'
            }
          });

          if (res.ok) {
            const repoData = await res.json();
            const hasPush = repoData.permissions?.push !== false;
            ghStatusEl.className = 'admin-gh-status is-success';
            ghStatusEl.textContent = `✓ Conexão bem-sucedida com "${repoData.full_name}"! ${hasPush ? 'Permissão de escrita confirmada.' : 'Atenção: verifique se o token tem permissão de escrita.'}`;
          } else if (res.status === 401) {
            ghStatusEl.className = 'admin-gh-status is-error';
            ghStatusEl.textContent = '❌ Erro 401: Token inválido ou expirado. Verifique o código inserido ou clique em "Regenerate token" no GitHub.';
          } else if (res.status === 404) {
            ghStatusEl.className = 'admin-gh-status is-error';
            ghStatusEl.textContent = `❌ Erro 404: Repositório "${repo}" não encontrado ou token sem acesso.`;
          } else {
            ghStatusEl.className = 'admin-gh-status is-error';
            ghStatusEl.textContent = `❌ Erro HTTP ${res.status}: ${res.statusText}`;
          }
        } catch (err) {
          ghStatusEl.className = 'admin-gh-status is-error';
          ghStatusEl.textContent = `❌ Falha na requisição: ${err.message}`;
        }
      });
    }

    // Publicar no GitHub
    if (ghPublishBtn) {
      ghPublishBtn.addEventListener('click', async () => {
        const cfg = getGitHubConfig();
        if (!cfg.token) {
          openModal();
          return;
        }

        const originalText = ghPublishBtn.innerHTML;
        ghPublishBtn.classList.add('is-loading');
        ghPublishBtn.disabled = true;
        ghPublishBtn.innerHTML = '⏳ Publicando...';

        try {
          const published = await this.saveAllChanges();
          if (published) closeModal();
        } catch (err) {
          alert(`Falha ao comunicar com o GitHub: ${err.message}`);
        } finally {
          ghPublishBtn.classList.remove('is-loading');
          ghPublishBtn.disabled = false;
          ghPublishBtn.innerHTML = originalText;
        }
      });
    }
  }

  setupJSONBackup() {
    if (this._jsonBackupDone) return;
    this._jsonBackupDone = true;

    const exportBtn = document.getElementById('admin-export-btn');
    const importBtn = document.getElementById('admin-import-btn');
    const importFileInput = document.getElementById('admin-import-file');

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const content = this.extractCurrentContent();
        content.updatedAt = new Date().toISOString();
        const jsonStr = JSON.stringify(content, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kmorais-content-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('📥 Arquivo JSON de conteúdo baixado com sucesso!');
      });
    }

    if (importBtn && importFileInput) {
      importBtn.addEventListener('click', () => {
        importFileInput.click();
      });

      importFileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const text = event.target.result;
            const imported = JSON.parse(text);
            if (!imported || typeof imported !== 'object' || Array.isArray(imported)) {
              throw new Error('O arquivo não contém um objeto de conteúdo válido.');
            }
            this.hasUnsavedChanges = true;
            document.body.classList.add('has-unsaved-changes');
            kmCMS.data = deepMerge(defaultCMSContent, imported);
            await kmCMS.applyToPage();
            const published = await this.saveAllChanges();
            if (published) this.showToast('✓ Conteúdo importado e publicado online!');
          } catch (err) {
            alert(`Não foi possível importar o JSON: ${err.message}`);
          } finally {
            importFileInput.value = '';
          }
        };
        reader.readAsText(file);
      });
    }
  }

  /**
   * Exibe um toast de notificação.
   * @param {string} message - Texto a exibir
   * @param {'success'|'error'|'warning'} type - Tipo visual do toast
   */
  showToast(message, type = 'success') {
    const icons = { success: '✓', error: '✕', warning: '⚠' };
    const icon = icons[type] || '✓';

    let toast = document.getElementById('admin-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'admin-toast';
      document.body.appendChild(toast);
    }

    toast.className = `admin-toast is-${type}`;
    toast.innerHTML = `<span class="admin-toast-check">${icon}</span> <span class="admin-toast-msg">${message}</span>`;
    toast.classList.add('is-visible');

    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.remove('is-visible');
    }, type === 'error' ? 5500 : 3800);
  }
}

// Inicializa no carregamento do DOM
document.addEventListener('DOMContentLoaded', () => {
  new KMAdminPanel();
});

