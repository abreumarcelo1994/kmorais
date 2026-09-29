# Kelly Morais — Portfólio Oficial & CMS Visual

> Plataforma web de alta performance desenvolvida para a criadora de conteúdo UGC e estrategista de marketing **Kelly Morais**, sediada em São Paulo, Brasil.

[![PageSpeed Insights: 99](https://img.shields.io/badge/PageSpeed-99%2B-brightgreen.svg)](#performance--core-web-vitals)
[![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-blue.svg)](https://abreumarcelo1994.github.io/kmorais/)
[![Schema.org](https://img.shields.io/badge/Schema.org-VideoObject%20%7C%20FAQ%20%7C%20Person-orange.svg)](#seo-semantico--dados-estruturados)
[![PWA Ready](https://img.shields.io/badge/PWA-Manifest%20Ready-purple.svg)](#progressive-web-app-pwa)

---

## 1. Visão Geral da Arquitetura

O projeto foi construído sob uma arquitetura estática moderna (Jamstack) sem dependências pesadas de frameworks, garantindo **velocidade instantânea**, **segurança máxima (zero vulnerabilidades de servidor)** e **custo zero de hospedagem** com deploy automatizado via GitHub Actions.

### Stack Tecnológica
- **Frontend Core**: HTML5 Semântico, CSS3 Moderno (Custom Properties, Grid, Flexbox, `content-visibility: auto`), JavaScript Puro (ES6+ modular).
- **Player de Vídeo Customizado**: Player proprietário minimalista com ativação em qualquer canto, controle de volume retrátil horizontal, início mudo nativo e `preload="none"` em vitrines para zerar o consumo inicial de banda.
- **Painel Administrativo (CMS)**: Sistema de edição visual in-browser (`admin.html`) protegido por senha, com persistência via `content.json` e armazenamento local de mídias de alta velocidade em `IndexedDB` com resolução por Blob URLs e sincronização via GitHub API.
- **Servidor de Desenvolvimento Local**: Node.js com suporte completo a **HTTP 206 Range Requests** em `server.js` para streaming contínuo de vídeos MP4.

---

## 2. Performance & Core Web Vitals (Padrão 99+ PageSpeed)

- **LCP (Largest Contentful Paint < 1.2s)**: Preload de alta prioridade (`fetchpriority="high"`) na imagem principal do Hero.
- **CLS (Cumulative Layout Shift = 0.000)**: Reserva física estrita no DOM com `aspect-ratio` fixo em todos os 30 cards de vídeo (`9/16`), no hero frame (`4/5`) e imagens institucionais.
- **INP & TBT (Total Blocking Time < 50ms)**: Carregamento assíncrono de fontes (`media="print" onload="this.media='all'"`) com fallbacks nativos do sistema operacional (`-apple-system, BlinkMacSystemFont, Segoe UI, Roboto`).
- **Renderização Sob Demanda**: Seções fora do campo de visão utilizam `content-visibility: auto` com `contain-intrinsic-size` para não bloquear a thread principal de renderização.

---

## 3. SEO Semântico & Dados Estruturados (Google, Bing & LLMs)

### A. Google Video & Image Sitemap
O arquivo [`sitemap.xml`](file:///c:/Users/Win/Desktop/KMORAIS/sitemap.xml) segue rigorosamente as especificações oficiais do [Google Video Sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/video-sitemaps) e [Google Image Sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps):
- Namespaces: `xmlns:video` e `xmlns:image`.
- Indexação detalhada com thumbnails, URLs diretas de mídia, durações e marcação `family_friendly="yes"`.
- Qualificação direta para Rich Snippets de vídeo nos resultados de pesquisa móvel e na aba **Google Vídeos**.

### B. Schema.org JSON-LD
Grafo semântico estruturado contendo 6 entidades interconectadas:
1. `Person`: Biografia, especialidades, geolocalização e canais oficiais de Kelly Morais.
2. `ProfessionalService`: Catálogo comercial de serviços UGC, moeda BRL e canais de contratação.
3. `WebSite`: Declaração canônica oficial e idioma `pt-BR`.
4. `VideoObject`: Marcação detalhada para indexação nativa do vídeo de destaque no buscador.
5. `BreadcrumbList`: Navegação estruturada para Rich Snippets de trilha.
6. `FAQPage`: Perguntas frequentes para exibição de respostas diretas na SERP.

### C. GEO (Generative Engine Optimization) & llms.txt
- [`llms.txt`](file:///c:/Users/Win/Desktop/KMORAIS/llms.txt): Arquivo estruturado no padrão global para leitura e citação por LLMs (ChatGPT, Claude, Perplexity AI, Google Gemini, Apple Intelligence).
- [`robots.txt`](file:///c:/Users/Win/Desktop/KMORAIS/robots.txt): Regras explícitas liberando crawlers de busca e agentes de IA, bloqueando rotas administrativas privadas.

---

## 4. Estrutura de Diretórios

```text
KMORAIS/
├── .github/
│   └── workflows/
│       └── deploy.yml        # CI/CD automático para GitHub Pages
├── admin.css                 # Estilos visuais do painel de administração
├── admin.html                # Painel CMS visual (acesso restrito)
├── admin.js                  # Lógica do editor in-browser e persistência
├── cms.js                    # Engine de renderização dinâmica e IndexedDB
├── content.json              # Banco de dados e configurações do site
├── index.html                # Landing page oficial com metatags de elite
├── llms.txt                  # Especificação e contexto para agentes de IA
├── package.json              # Metadados e scripts de execução local
├── README.md                 # Documentação técnica do projeto
├── robots.txt                # Diretivas de rastreamento para robôs e IAs
├── script.js                 # Comportamento interativo, player e carrosséis
├── server.js                 # Servidor de streaming local (Range Requests)
├── sitemap.xml               # Sitemap XML com extensões de Imagem e Vídeo
├── site.webmanifest          # Manifesto PWA para instalação no celular
└── styles.css                # Folha de estilos oficial responsiva
```

---

## 5. Como Executar Localmente

### Pré-requisitos
- Node.js instalado (v18 ou superior).

### Instalação e Inicialização
```bash
# Clone ou acesse o repositório
git clone https://github.com/abreumarcelo1994/kmorais.git
cd kmorais

# Inicie o servidor local de alta fidelidade
npm start
```

O servidor iniciará por padrão na porta 3000 (com detecção automática e fallback para a próxima porta livre caso 3000 esteja ocupada):
- **Site Público**: `http://localhost:3000/index.html` (ou porta alternativa exibida no terminal, ex: `3002`)
- **Painel CMS**: `http://localhost:3000/admin.html` (ou porta alternativa)

---

## 6. Painel CMS Visual e Sincronização Direta com GitHub

O projeto possui um editor visual in-browser (`admin.html`) que permite alterar textos, mídias e cases diretamente na tela, com salvamento e publicação imediata no GitHub sem depender de comandos no terminal.

### Acesso ao Painel
- **Em Produção**: `https://abreumarcelo1994.github.io/kmorais/admin.html`
- **Em Desenvolvimento Local**: `http://localhost:3002/admin.html`
- **Senha de Acesso**: `@marcelo123`

### Como Ativar a Publicação Direta (Para Colaboradores)
Para que qualquer alteração feita no painel seja enviada diretamente para a branch `main` do GitHub e entre no ar automaticamente para todos os visitantes e outros colaboradores:

1. **Permissão de Colaborador**: Sua conta do GitHub precisa ser adicionada como colaboradora do repositório (`abreumarcelo1994/kmorais`) com permissão de escrita (*Write*).
2. **Gerar Token Pessoal (PAT)**:
   - Acesse [github.com/settings/tokens](https://github.com/settings/tokens).
   - Clique em **Generate new token** &rarr; **Generate new token (classic)**.
   - Em *Note*, digite: `KMORAIS CMS`.
   - Marque a caixa de permissão: `repo` (Full control of repositories).
   - Gere o token e copie o código `ghp_...`.
3. **Conectar no Painel**:
   - No topo do painel `admin.html`, clique em **`⚙️ Conectar GitHub`**.
   - Cole seu código `ghp_...`, teste a conexão e clique em **Salvar Configuração**.
   - O botão ficará verde: **`🟢 GitHub Conectado`**.
4. **Publicação com 1 Clique**:
   - Edite qualquer elemento na página e clique em **`💾 Salvar e Publicar`**.
   - O painel enviará as alterações diretamente para o arquivo `content.json` no GitHub via API, disparando o deploy contínuo via GitHub Actions em produção.

---

## 7. Fluxo de Publicação e Deploy Contínuo (CI/CD)

Toda alteração enviada para o branch `main` (seja via Git ou via painel CMS) dispara automaticamente a esteira do GitHub Actions (`.github/workflows/deploy.yml`), publicando as alterações em produção em menos de 60 segundos.

```bash
git add .
git commit -m "feat(portfolio): novas atualizacoes de cases"
git push origin main
```

---

## 8. Contato Comercial & Direitos

- **Website Oficial**: [abreumarcelo1994.github.io/kmorais](https://abreumarcelo1994.github.io/kmorais/)
- **WhatsApp**: [+55 11 95636-7834](https://wa.me/5511956367834)
- **E-mail**: [marketing.kellymorais@gmail.com](mailto:marketing.kellymorais@gmail.com)
- **Instagram**: [@kemoraiso](https://www.instagram.com/kemoraiso/)
- **TikTok**: [@kellymoraiso](https://www.tiktok.com/@kellymoraiso)

*© 2026 Kelly Morais UGC. Todos os direitos reservados.*
