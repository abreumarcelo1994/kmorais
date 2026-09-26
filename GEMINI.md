# DIRETRIZES TÉCNICAS E PROTOCOLO MANDATÓRIO DE SINCRONIZAÇÃO — KMORAIS

Este documento estabelece as regras obrigatórias de desenvolvimento e governança para este repositório.
**Nível de Exigência: Enterprise / Estritamente Profissional (Zero Amadorismo).**

---

## 1. Regra de Ouro: Sincronização Obrigatória a Cada Atualização

Sempre que qualquer elemento do site for modificado (código, layout, mídias, textos, CMS ou dados), é **terminantemente obrigatório** auditar, atualizar e sincronizar todos os documentos satélites antes de concluir o ciclo:

1. **`sitemap.xml`**:
   - Atualizar `<lastmod>` para o timestamp W3C estrito com fuso horário (`YYYY-MM-DDTHH:MM:SS-03:00`).
   - Se novos vídeos, capas ou fotos forem adicionados/alterados, atualizar as tags `<video:video>` (com thumbnail, content_loc, duration, publication_date, family_friendly) e `<image:image>`.

2. **`robots.txt`**:
   - Garantir a proteção contra indexação do painel (`Disallow: /admin.html`, `/admin.js`, `/admin.css`).
   - Garantir autorização irrestrita aos motores de busca (`Googlebot`, `Bingbot`, etc.) e aos agentes de IA/GEO (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `Applebot-Extended`, etc.).

3. **`llms.txt`**:
   - Sincronizar qualquer alteração em serviços, marcas atendidas, métricas, nichos, formatos de entrega ou canais de contato.
   - Manter a densidade semântica máxima para buscas generativas.

4. **`index.html` (SEO, Social & Schema.org JSON-LD)**:
   - Sincronizar o grafo Schema.org (`Person`, `ProfessionalService`, `WebSite`, `FAQPage`, `BreadcrumbList`, `VideoObject`).
   - Manter as tags Open Graph e Twitter Cards (`1200x630px`) rigorosamente válidas.
   - Preservar integridade do `<link rel="manifest" href="site.webmanifest">` e `<link rel="canonical">`.

5. **`site.webmanifest`**:
   - Manter o manifesto PWA atualizado com nome, cores de tema (`#1e2522`) e ícones operacionais.

6. **`README.md`**:
   - Manter a documentação técnica executiva alinhada com as novas capacidades, fluxos de CI/CD ou comandos do projeto.

---

## 2. Padrões de Performance & Core Web Vitals (Nota 99+ PageSpeed)

- **CLS (Cumulative Layout Shift) = 0.000**:
  - Toda tag `<img>` e `<video>` DEVE ter `width`, `height` e `aspect-ratio` fixos no CSS.
- **LCP (Largest Contentful Paint) < 1.2s**:
  - A imagem de poster do Hero deve manter `<link rel="preload" as="image" fetchpriority="high">`.
- **Zero Desperdício de Banda Inicial**:
  - Todos os vídeos de vitrine/portfólio devem carregar com `preload="none"`. O navegador só deve baixar mídia sob clique/interação voluntária do usuário.
- **Renderização Assíncrona de Fontes**:
  - Manter fontes com `media="print" onload="this.media='all'"` e fallbacks de sistema no CSS.

---

## 3. Segurança e Limpeza de Banco de Dados

- O arquivo `content.json` é a fonte da verdade do CMS. Nunca deixar referências a caminhos de arquivos de teste, blobs órfãos ou dados provisórios.
- Nenhum script, arquivo txt duplicado, mídia temporária ou backup redundante deve permanecer no repositório.
- Todo commit deve passar previamente por validação de sintaxe (`node -c`).
