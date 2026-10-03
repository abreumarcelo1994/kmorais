# DIRETRIZES TÉCNICAS E PROTOCOLO MANDATÓRIO DE GOVERNANÇA — KMORAIS

Este documento consolida todas as decisões arquiteturais, comandos do projeto e regras obrigatórias de desenvolvimento para este repositório.
**Nível de Exigência: Enterprise / Estritamente Profissional (Zero Amadorismo).**

---

## 1. Regra de Ouro: Sincronização Obrigatória a Cada Atualização

Sempre que qualquer elemento do site for modificado (código, layout, mídias, textos, CMS ou dados), é **terminantemente obrigatório** auditar, atualizar e sincronizar todos os documentos satélites antes de concluir o ciclo:

1. **`sitemap.xml` (Protocolo Google Video & Image)**:
   - Atualizar `<lastmod>` para o timestamp W3C estrito com fuso horário (`YYYY-MM-DDTHH:MM:SS-03:00`).
   - Se novos vídeos, capas ou fotos forem adicionados/alterados, atualizar as tags `<video:video>` (com `thumbnail_loc`, `content_loc`, `duration`, `publication_date`, `family_friendly="yes"`) e `<image:image>`.

2. **`robots.txt`**:
   - Garantir a proteção contra indexação do painel (`Disallow: /admin.html`, `/admin.js`, `/admin.css`).
   - Garantir autorização irrestrita aos motores de busca tradicionais (`Googlebot`, `Bingbot`, `Googlebot-Image`, `Googlebot-Video`, etc.) e aos agentes de IA/GEO (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `Applebot-Extended`, etc.).

3. **`llms.txt`**:
   - Sincronizar qualquer alteração em serviços, marcas atendidas, métricas, nichos, formatos de entrega ou canais de contato.
   - Manter a densidade semântica máxima para buscas generativas.

4. **`index.html` (SEO, Social & Schema.org JSON-LD)**:
   - Sincronizar o grafo Schema.org com 6 entidades oficiais (`Person`, `ProfessionalService`, `WebSite`, `FAQPage`, `BreadcrumbList`, `VideoObject`).
   - Manter as tags Open Graph e Twitter Cards (`1200x630px`) rigorosamente válidas.
   - Preservar integridade do `<link rel="manifest" href="site.webmanifest">`, `<link rel="apple-touch-icon">` e `<link rel="canonical">`.

5. **`site.webmanifest`**:
   - Manter o manifesto PWA atualizado com nome, cores de tema (`#1e2522`) e ícones operacionais.

6. **`README.md`**:
   - Manter a documentação técnica executiva alinhada com as novas capacidades, fluxos de CI/CD ou comandos do projeto.

---

## 2. Especificação do Player de Vídeo Minimalista

O player de vídeo do site segue uma arquitetura proprietária minimalista, focada em conversão e experiência de usuário, sem interferências dos controles nativos do navegador:

- **Play/Pause por Clique Global no Card**:
  - Clicar ou tocar em qualquer ponto do card/vídeo deve alternar entre reprodução e pausa, acionando o feedback visual central (`.video-play-pulse`).
  - Nenhum botão central de play estático, timer ou menu de ações deve ser exibido.
- **Início Mudo Obrigatório**:
  - Todo vídeo DEVE iniciar 100% mutado (`video.muted = true; video.controls = false;`).
- **Controle de Volume com Slider Retrátil**:
  - O controle sonoro fica fixo no canto inferior direito (`.video-sound-control`).
  - Ao passar o mouse ou ativar o som, o slider de volume horizontal expande-se suavemente para a esquerda (`flex-direction: row-reverse`).
  - Ajustar o slider ou clicar no botão de som **NUNCA** pode pausar/despausar o vídeo (`stopPropagation` ativo em cliques, toques e arrasto).
- **Exclusividade Sonora**:
  - Ao desmutar ou subir o volume de um vídeo, **todos os outros vídeos da página devem ser mutados instantaneamente**, garantindo apenas uma fonte sonora por vez.
- **Controles Nativos Ocultos**:
  - Preservar `video::-webkit-media-controls { display: none !important; }` para evitar poluição visual em Safari, Chrome e Edge.

---

## 3. Prevenção de Flash de Conteúdo Antigo (FOIC) & Gestão de Mídias

Para eliminar o efeito indesejado onde a imagem antiga aparece por frações de segundo antes da imagem nova ao recarregar a página:

- **Script Pré-Aplicador Síncrono no `<head>`**:
  - Manter o script inline no `<head>` de `index.html` e `admin.html` que lê o cache (`localStorage.getItem('kmorais_cms_content_v1')`) antes da primeira pintura de tela pelo navegador.
- **Limpeza de Mídias Órfãs (`cleanupOrphans`)**:
  - Ao alterar uma imagem ou vídeo no CMS, mídias antigas substituídas devem ser expurgadas da base de dados e do `IndexedDB` (`KMMediaStore.cleanupOrphans`), nunca deixando arquivos mortos em cache que possam reaparecer.
- **Botão Restaurar com Purge Completo**:
  - A ação de restauração no painel administrativo deve limpar simultaneamente o `localStorage` e o banco `IndexedDB`.

---

## 4. Padrões de Performance & Core Web Vitals (Nota 99+ PageSpeed)

- **CLS (Cumulative Layout Shift) = 0.000**:
  - Toda tag `<img>` e `<video>` DEVE ter `width`, `height` e `aspect-ratio` fixos no CSS.
  - Proporções fixas: cards de vídeo verticais `9/16`, Hero frame `4/5`.
- **LCP (Largest Contentful Paint) < 1.2s**:
  - A imagem de poster do Hero deve manter `<link rel="preload" as="image" fetchpriority="high">`.
- **Zero Desperdício de Banda Inicial**:
  - Todos os vídeos de vitrine/portfólio devem carregar com `preload="none"`. O navegador só deve baixar mídia sob clique/interação voluntária do usuário.
- **Renderização Sob Demanda**:
  - Seções fora da tela devem utilizar `content-visibility: auto` com `contain-intrinsic-size` para não bloquear a renderização inicial.
- **Renderização Assíncrona de Fontes**:
  - Manter fontes com `media="print" onload="this.media='all'"` e fallbacks de sistema no CSS.
- **Padronização Automática WebP em Qualquer Mídia de Imagem**:
  - Toda imagem enviada no painel admin (foto de perfil, capas, logos ou posters) é compulsoriamente convertida para o formato **WebP** (`convertImageToWebp`) diretamente no navegador antes de ser salva em Base64 ou enviada para a pasta `media/` do GitHub.
  - Imagens raster devem ser redimensionadas proporcionalmente (largura máxima de 1280px) com taxa de compressão `quality: 0.80`, reduzindo o peso original em até 85-98%.
  - Vetores (`image/svg+xml`) devem ser preservados como SVG puros para máxima nitidez.
  - URLs externas (como Unsplash e Cloudinary) devem passar por `normalizeImageUrl`, garantindo injeção forçada de `fm=webp&auto=format&fit=crop` e compressão adequada.

---

## 5. Segurança, Banco de Dados e Higiene de Repositório

- O arquivo `content.json` é a fonte da verdade do CMS. Nunca deixar referências a caminhos de arquivos de teste, blobs órfãos ou dados provisórios.
- Nenhum script de teste, arquivo txt duplicado, mídia temporária ou backup redundante deve permanecer no repositório.
- Todo commit deve passar previamente por validação de sintaxe (`node -c`).
- O site opera em arquitetura Jamstack de alta performance, sem custos de servidor backend e com deploy automatizado via GitHub Actions.
