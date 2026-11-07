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

## Proxy de imagens — implementação opcional (etapa seguinte)

O backend Express agora disponibiliza `GET /api/image?url=<URL_ENCODED>`, com módulos em `js/server/image-fetch.js` e `js/server/image-proxy.js`. A função cliente `proxiedImageUrl` (`js/security/media-url.js`) roteia imagens de posts, previews e avatares pelo proxy quando configurado.

**Deploy sem quebra:** `IMAGE_PROXY_ORIGIN = ""` em `js/config.js` mantém o comportamento atual no GitHub Pages. Em `http://localhost:3000` a rota é usada automaticamente para facilitar testes. Após implantar um serviço Render com o mesmo código, configure `IMAGE_PROXY_ORIGIN = "https://SEU-SERVICO.onrender.com"` no front-end e publique outra PR. Isso mudará o `src` da mídia para o proxy, sem precisar alterar o formato dos posts na blockchain. **O backend não está automaticamente hospedado pelo GitHub Pages.**

**Defesas implementadas no servidor:**
- Somente `https:` com porta padrão 443 e sem credenciais embutidas.
- Bloqueio de faixas IP locais/privadas, loopback, link-local, metadados e reservas; validação das respostas DNS e **pinning** do IP conferido na conexão TLS.
- Sem seguir redirecionamentos HTTP, impedindo saltos para destinos privados.
- Respostas aceitas: JPEG, PNG, GIF, WebP e AVIF, com verificação de assinatura de arquivo. SVG e HTML são recusados.
- Timeout 8 segundos, máximo 5 MB por imagem, até 8 requisições de origem simultâneas, cache LRU de 24 MB com TTL de uma hora, e limite por endereço de conexão de 600 requisições por minuto.
- Nunca encaminha cookies/headers de autorização do visitante ou `Set-Cookie` do servidor original; responde com `nosniff`, `Cache-Control` e `Cross-Origin-Resource-Policy: cross-origin`.

**Observações de produção:** rate limiting em memória não substitui limites na borda (Render, Cloudflare etc.). Em Render, o endereço observado no socket pode ser o do proxy reverso, agrupando visitantes no mesmo bucket. Ajuste métricas e política antes de atender muito tráfego. O proxy limita o risco de SSRF, mas uma auditoria de implantação e testes externos continuam necessários.

**CSP atual:** `img-src 'self' https: data:` permanece intocada para permitir a transição. Somente após a implantação do backend e migração de todas as imagens poderemos restringi-la à origem controlada do proxy (e ao `data:` necessário para os avatares de fallback). Uma CSP no GitHub Pages não consegue autorizar uma origem que ainda não foi escolhida.

**Escopo de privacidade:** o proxy esconde o endereço IP do visitante apenas em imagens efetivamente roteadas. Clicar em links externos continua acessando os sites diretamente. Não transforma imagens externas em conteúdo confiável por si só.

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
