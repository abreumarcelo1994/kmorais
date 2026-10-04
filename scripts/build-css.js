/**
 * scripts/build-css.js — KMORAIS CSS Build & Minifier
 * Minifica styles.src.css gerando styles.css enxuto para produção (Lighthouse Performance).
 */

const fs = require('fs');
const CleanCSS = require('clean-css');

console.log('📦 Minificando CSS para produção...');

const sourceFile = fs.existsSync('styles.src.css') ? 'styles.src.css' : 'styles.css';
const css = fs.readFileSync(sourceFile, 'utf8');

// Garante que a cópia de desenvolvimento exista
if (!fs.existsSync('styles.src.css')) {
  fs.writeFileSync('styles.src.css', css, 'utf8');
}

const minifier = new CleanCSS({
  level: {
    1: {
      all: true,
      specialComments: 0
    }
  }
});

const output = minifier.minify(css);

if (output.errors && output.errors.length > 0) {
  console.error('❌ Erro na minificação do CSS:', output.errors);
  process.exit(1);
}

if (output.warnings && output.warnings.length > 0) {
  console.warn('⚠️ Avisos na minificação do CSS:', output.warnings);
}

fs.writeFileSync('styles.css', output.styles, 'utf8');

const originalKb = (css.length / 1024).toFixed(1);
const minifiedKb = (output.styles.length / 1024).toFixed(1);
const savedKb = (originalKb - minifiedKb).toFixed(1);

console.log(`✅ styles.css minificado com sucesso: ${originalKb} KB -> ${minifiedKb} KB (Economia: ${savedKb} KB / ~${((savedKb / originalKb) * 100).toFixed(0)}%)\n`);
