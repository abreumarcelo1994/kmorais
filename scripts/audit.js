/**
 * scripts/audit.js — KMORAIS Quality Gate & Performance Guard
 * Executa auditoria estrita em código, mídias, JSON e parâmetros de alta performance.
 * Pode ser executado localmente via `npm run audit` e no GitHub Actions CI/CD.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 [KMORAIS Quality Gate] Iniciando auditoria de padrões...\n');

let hasErrors = false;
let warnings = [];

// 1. Validação de Sintaxe JavaScript
console.log('1. Validando sintaxe JavaScript...');
const jsFiles = ['script.js', 'cms.js', 'admin.js', 'server.js', 'sw.js'];
for (const file of jsFiles) {
  if (fs.existsSync(file)) {
    try {
      execSync(`node -c ${file}`, { stdio: 'pipe' });
      console.log(`   ✅ ${file} (sintaxe válida)`);
    } catch (err) {
      console.error(`   ❌ ERRO em ${file}:`, err.message);
      hasErrors = true;
    }
  }
}

// 2. Validação e Higiene do content.json
console.log('\n2. Auditando content.json (Fonte da Verdade)...');
if (fs.existsSync('content.json')) {
  try {
    const raw = fs.readFileSync('content.json', 'utf8');
    const data = JSON.parse(raw);
    const sizeKb = (raw.length / 1024).toFixed(1);
    console.log(`   ✅ JSON válido (Tamanho total: ${sizeKb} KB)`);

    if (raw.length > 50 * 1024) {
      console.error(`   ⚠️ ALERTA: content.json excede 50 KB (${sizeKb} KB). Verifique Base64 embutido!`);
      hasErrors = true;
    }

    // Varre se há base64 embutido ou identificadores locais idb:/blob:
    function checkMediaPortability(obj, path = '') {
      for (const k in obj) {
        const val = obj[k];
        const currentPath = path ? `${path}.${k}` : k;
        if (typeof val === 'string') {
          if (val.startsWith('idb:') || val.startsWith('blob:')) {
            console.error(`   ❌ ERRO: Referência local não portável detectada em ${currentPath}: "${val}". Deve ser URL pública ou caminho relativo!`);
            hasErrors = true;
          }
          if (val.startsWith('data:image/') && val.length > 5000) {
            console.error(`   ❌ ERRO: Base64 pesado detectado em ${currentPath} (${(val.length / 1024).toFixed(1)} KB)`);
            hasErrors = true;
          }
        } else if (typeof val === 'object' && val) {
          checkMediaPortability(val, currentPath);
        }
      }
    }
    checkMediaPortability(data);

    // Verifica parâmetros Unsplash no content.json
    function checkUnsplash(obj) {
      for (const k in obj) {
        const val = obj[k];
        if (typeof val === 'string' && val.includes('images.unsplash.com')) {
          try {
            const u = new URL(val);
            const q = Number(u.searchParams.get('q'));
            if (q > 65) {
              warnings.push(`Unsplash URL com qualidade alta (${q}) em ${k}: ${val}`);
            }
          } catch (_) {}
        } else if (typeof val === 'object' && val) {
          checkUnsplash(val);
        }
      }
    }
    checkUnsplash(data);

  } catch (err) {
    console.error('   ❌ ERRO ao parsear content.json:', err.message);
    hasErrors = true;
  }
}

// 3. Auditoria de Mídias Locais (media/)
console.log('\n3. Auditando integridade e peso das mídias locais (media/)...');
if (fs.existsSync('media')) {
  const mediaFiles = fs.readdirSync('media');
  for (const f of mediaFiles) {
    const fullPath = path.join('media', f);
    const stat = fs.statSync(fullPath);
    const sizeKb = stat.size / 1024;

    if (f.endsWith('.webp')) {
      if (sizeKb > 120) {
        console.error(`   ❌ ERRO: Imagem WebP pesada detectada: ${f} (${sizeKb.toFixed(1)} KB > 120 KB)`);
        hasErrors = true;
      } else {
        console.log(`   ✅ ${f} (${sizeKb.toFixed(1)} KB)`);
      }

      // Validação de assinatura mágica WebP (evita PNGs renomeados)
      const buf = fs.readFileSync(fullPath);
      const isRiff = buf.slice(0, 4).toString('ascii') === 'RIFF';
      const isWebp = buf.slice(8, 12).toString('ascii') === 'WEBP';
      if (!isRiff || !isWebp) {
        console.error(`   ❌ ERRO: ${f} não é um arquivo WebP válido (formato corrompido ou PNG renomeado)!`);
        hasErrors = true;
      }
    }
  }
}

// 4. Verificação de Alinhamento LCP (index.html vs content.json)
console.log('\n4. Verificando consistência do LCP Preload (index.html)...');
if (fs.existsSync('index.html') && fs.existsSync('content.json')) {
  const html = fs.readFileSync('index.html', 'utf8');
  const json = JSON.parse(fs.readFileSync('content.json', 'utf8'));

  const preloadMatch = html.match(/<link\s+rel="preload"\s+as="image"\s+href="([^"]+)"\s+fetchpriority="high"/i);
  if (preloadMatch) {
    const preloadUrl = preloadMatch[1].replace(/&amp;/g, '&');
    console.log(`   ✅ Preload configurado: ${preloadUrl}`);
    if (json.hero && json.hero.poster) {
      if (json.hero.poster !== preloadUrl) {
        warnings.push(`O poster do Hero em content.json (${json.hero.poster}) é diferente do preload em index.html (${preloadUrl}).`);
      }
    }
  } else {
    warnings.push('Nenhuma tag <link rel="preload" as="image" fetchpriority="high"> encontrada no <head> de index.html.');
  }
}

// 5. Verificação do Sitemap e Service Worker
console.log('\n5. Verificando sitemap.xml e sw.js...');
if (fs.existsSync('sitemap.xml')) {
  const sitemap = fs.readFileSync('sitemap.xml', 'utf8');
  const match = sitemap.match(/<lastmod>(.*?)<\/lastmod>/);
  if (match) {
    console.log(`   ✅ sitemap.xml lastmod ativo: ${match[1]}`);
  }
}
if (fs.existsSync('sw.js')) {
  console.log('   ✅ Service Worker (sw.js) presente no repositório');
}

// 6. Verificação de Minificação do CSS (Lighthouse CWV)
console.log('\n6. Verificando minificação de styles.css...');
if (fs.existsSync('styles.css')) {
  const css = fs.readFileSync('styles.css', 'utf8');
  const cssKb = (css.length / 1024).toFixed(1);
  if (css.length > 65 * 1024) {
    console.error(`   ❌ ERRO: styles.css não está minificado (${cssKb} KB > 65 KB). Execute 'npm run build:css'!`);
    hasErrors = true;
  } else {
    console.log(`   ✅ styles.css minificado para produção (${cssKb} KB)`);
  }
}

// 7. Verificação de Minificação do JavaScript (Lighthouse CWV)
console.log('\n7. Verificando minificação de script.js e cms.js...');
const prodJs = [
  { name: 'script.js', maxKb: 28 },
  { name: 'cms.js', maxKb: 28 }
];
for (const { name, maxKb } of prodJs) {
  if (fs.existsSync(name)) {
    const raw = fs.readFileSync(name, 'utf8');
    const kb = (raw.length / 1024).toFixed(1);
    if (raw.length > maxKb * 1024) {
      console.error(`   ❌ ERRO: ${name} não está minificado (${kb} KB > ${maxKb} KB). Execute 'npm run build:js'!`);
      hasErrors = true;
    } else {
      console.log(`   ✅ ${name} minificado para produção (${kb} KB)`);
    }
  }
}

// Relatório Final
console.log('\n' + '='.repeat(50));
if (warnings.length > 0) {
  console.log(`⚠️  ${warnings.length} AVISO(S) DE QUALIDADE:`);
  warnings.forEach(w => console.log(`   - ${w}`));
}

if (hasErrors) {
  console.error('\n❌ AUDITORIA FALHOU! Há violações de padrões que precisam ser corrigidas antes do deploy.\n');
  process.exit(1);
} else {
  console.log('\n✨ AUDITORIA CONCLUÍDA COM SUCESSO! Todos os padrões de excelência estão cumpridos.\n');
  process.exit(0);
}
