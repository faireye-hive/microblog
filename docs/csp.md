# CSP — implantação incremental do Micro.fair

Esta etapa adiciona uma **Content Security Policy efetiva** em `index.html` (GitHub Pages), na página `404.html` e por cabeçalho HTTP no Express. O Express lê a política do `index.html` em inicialização para evitar duas listas independentes.

## Fontes autorizadas

| Diretiva | Política | Por quê |
|---|---|---|
| `default-src` | `'none'` | Negar por padrão fontes não listadas |
| `script-src` | `'self'` | JS do próprio aplicativo; **sem scripts inline, CDN ou eval** |
| `connect-src` | `'self' https://rpc.mahdiyari.info` | Requisições HAFSQL e same-origin |
| `style-src` | `'self' 'unsafe-inline' https://fonts.googleapis.com` | CSS atual usa muitos `style=""`; carregamento Google Fonts |
| `font-src` | `'self' https://fonts.gstatic.com` | Fontes Google |
| `img-src` | `'self' https: data:` | Avatares, imagens HTTPS postadas por usuários e fallback SVG |
| `media-src` | `'self' https:` | Conteúdo de mídia HTTPS |
| `object-src`, `frame-src`, `worker-src`, `base-uri` | `'none'` | Desabilitar plugins, frames, workers e mudança de URL base |
| `manifest-src`, `form-action` | `'self'` | Apenas recursos/formulários locais |

O servidor Express também envia `frame-ancestors 'self'` no cabeçalho CSP da página HTML, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff` e `Permissions-Policy`. `frame-ancestors` **não é permitido** dentro de `<meta http-equiv="Content-Security-Policy">`; no GitHub Pages esse controle exigiria um serviço que altere os cabeçalhos (por exemplo, Cloudflare na frente do domínio).

O `index.html` contém também `<meta name="referrer" content="no-referrer">`, aplicável ao GitHub Pages. Isso reduz vazamento da URL visitada para sites externos, mas **não esconde o IP** ao baixar imagens de outras origens.

## Por que `unsafe-inline` ainda existe em `style-src`

Há diversos templates e componentes que geram `style=""` dinamicamente. Remover essa exceção agora apagaria estilos de posts, modais e cards. A exceção existe **somente em CSS**; JavaScript não pode usar `unsafe-inline` nem `unsafe-eval`. Próxima etapa: mover estilos inline para classes CSS, e então remover `unsafe-inline` de `style-src`.

## Proxy de imagem — próximo trabalho separado

`images.hive.blog` já atua como serviço de imagens para avatares, mas qualquer imagem externa em um post pode vir de outro domínio. Um proxy **sob controle do Micro.fair** pode reduzir a exposição do IP do visitante ao servidor original e permitir restringir `img-src` a esse proxy.

- Hospedar o proxy no **backend Render** ou Worker, não no GitHub Pages estático.
- Apenas buscar URLs HTTPS, recusar endereços internos, de loopback, link-local e endpoints de metadados; repetir verificações em redirecionamentos e ao resolver DNS (prevenção de SSRF).
- Limitar tamanho, timeout e tipo de imagem; não encaminhar cookies nem cabeçalhos privados.
- Aplicar cache, rate limit, limites de uso e política de conteúdo; não virar proxy público arbitrário.
- Após migração e confirmação de URLs, restringir `img-src` a origens controladas e fallback `data:`.

Este PR **não implementa** proxy nem altera as URLs das imagens dos posts.

## Checklist manual antes de liberar a CSP em produção

1. Com **Hive Keychain instalada**, abrir o aplicativo no Firefox e Chromium e confirmar `window.hive_keychain` (a extensão injeta sua API no contexto de página; a CSP da página pode afetar diferentes métodos de injeção).
2. Fazer login (assinatura), publicar no feed principal, responder e votar.
3. Abrir `#/channel/hive.micro`, publicar e verificar que `hive.micro` e `hivemicro` continuam distintos.
4. Verificar previews, imagens externas HTTPS, avatares e fallback SVG; testar que links externos funcionam.
5. Abrir o console: revisar `Content Security Policy` / `securitypolicyviolation`. Em especial, identificar se alguma parte do **Keychain** foi bloqueada por `script-src 'self'` ou `frame-src 'none'`.
6. Verificar GET de `/index.html` (Express: cabeçalhos CSP) e `404.html` (nenhum script CDN e CSP incluída); conferir também deploy no GitHub Pages.

## Riscos e limites

- **Compatibilidade Keychain ainda não comprovada em navegador com extensão real.** Os testes em Node protegem estrutura da política, mas não simulam extensões.
- `img-src https:` permite imagens de qualquer host HTTPS, enquanto posts continuarem com mídia externa arbitrária.
- `style-src 'unsafe-inline'` é uma exceção temporária a ser removida por refatoração visual.
- `meta` não permite CSP em modo Report-Only, `frame-ancestors` nem relatórios remotos. Report-Only/telemetria exigem controle sobre HTTP headers.
- Política CSP é uma defesa adicional, não substitui sanitização de HTML e verificações de autoridade dos `custom_json`.
