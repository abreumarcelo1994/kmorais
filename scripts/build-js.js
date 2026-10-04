/**
 * scripts/build-js.js — KMORAIS JavaScript Build & Minifier
 * Minifica script.src.js e cms.src.js gerando script.js e cms.js para produção.
 */

const fs = require('fs');
const { minify } = require('terser');

async function build() {
  console.log('📦 Minificando JavaScript para produção...');

  const files = [
    { src: 'script.src.js', dest: 'script.js' },
    { src: 'cms.src.js', dest: 'cms.js' }
  ];

  for (const { src, dest } of files) {
    // Garante que o arquivo fonte (.src.js) exista
    if (!fs.existsSync(src)) {
      if (fs.existsSync(dest)) {
        fs.copyFileSync(dest, src);
      }
    }

    const code = fs.readFileSync(src, 'utf8');
    const result = await minify(code, {
      compress: {
        toplevel: false,
        unused: false
      },
      mangle: {
        toplevel: false,
        reserved: [
          'kmCMS',
          'KMCMS',
          'KMMediaStore',
          'kmMediaStore',
          'attachSoundButton',
          'muteAllVideosExcept',
          'normalizeVideoUrl',
          'normalizeImageUrl'
        ]
      }
    });

    if (result.error) {
      console.error(`❌ Erro ao minificar ${src}:`, result.error);
      process.exit(1);
    }

    fs.writeFileSync(dest, result.code, 'utf8');

    const origKb = (code.length / 1024).toFixed(1);
    const minKb = (result.code.length / 1024).toFixed(1);
    const savedKb = (origKb - minKb).toFixed(1);
    console.log(`✅ ${dest} minificado com sucesso: ${origKb} KB -> ${minKb} KB (Economia: ${savedKb} KB / ~${((savedKb / origKb) * 100).toFixed(0)}%)`);
  }
  console.log('');
}

build().catch(err => {
  console.error('❌ Falha no build de JS:', err);
  process.exit(1);
});
