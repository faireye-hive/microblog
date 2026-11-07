# Arquitetura do micro.fair — migração incremental

O frontend continua **Vanilla JavaScript (ES Modules)**, compatível com GitHub Pages. O objetivo é separar responsabilidades sem mudar o protocolo nem exigir reescrever a interface.

## Limites criados nesta etapa

| Camada | Módulos | Responsabilidade |
| --- | --- | --- |
| Protocolo Hive | `js/hive/protocol.js` | Gera payloads `custom_json` v1, sem DOM ou rede |
| Assinatura Hive | `js/hive/keychain.js` | Envia operações via Posting Key/Keychain, sem UI |
| Consulta HAFSQL | `js/data/hafsql.js` | Monta URLs, aplica cursor, busca JSON e normaliza respostas |
| Cache | `js/data/cache-keys.js` | Mantém nomes históricos do `localStorage` |
| Sincronização | `js/data/sync.js` | Busca paginada, cache auxiliar incremental e dados por usuário |
| Cache de publicações | `js/data/post-cache.js` | IndexedDB com migração do `localStorage` e fallback |
| Consolidação de posts | `js/data/post-merge.js` | Deduplicação de operações por ID e canal |
| Identidade de canais | `js/helpers/channel-id.js` | Validação sem transformar `hive.micro` em `hivemicro` |
| Registro de canais | `js/helpers/channels.js` | Converte operações do registro em objetos de canal |
| Orquestração antiga | `js/api.js` | Ainda coordena sync, cache e efeitos de UI; migração futura |

Os consumidores permanecem com os mesmos imports de `js/api.js`. Não foram alterados os atributos `app`, `v`, `type`, `channel`, `content`, `reply_to`, `mentions` e `tags` dos posts, nem os IDs de voto, follow, bloqueio e canais.

## Estrutura atual (núcleo)

```text
js/
  app.js             # montagem e event handlers
  api.js             # adaptador existente para módulos novos (gradualmente)
  config.js          # IDs e endpoints públicos
  state.js           # estado e cache de UI (legado)
  routing.js         # rotas por hash (legado)
  render.js          # cartões e páginas (legado)
  templates.js       # templates (legado)
  hive/
    protocol.js      # payloads on-chain (puro)
    keychain.js      # assinatura custom_json
  data/
    hafsql.js        # transporte HAFSQL
    cache-keys.js    # nomes de cache
    sync.js          # HAFSQL sync incremental e paginação
    post-cache.js    # IndexedDB do feed e canais
    post-merge.js    # merge de operações sem duplicação
  helpers/
    channel-id.js
    channels.js
tests/
  architecture-boundaries.test.mjs
  channel-ids.test.mjs
  mobile-nav.test.mjs
```

## Validação

`npm test` executa os testes nativos do Node.js. O workflow CI também executa `npm test` em cada PR para `develop`.

## Regras para próximas etapas

1. **Preservar o protocolo:** não renomear os IDs `micro.fair`, `micro.fair.interation`, `micro.fair.channels` nem as propriedades `custom_json` sem migração explícita.
2. **Evitar quebrar caches:** novas implementações devem reconhecer as chaves históricas e oferecer migração para IndexedDB antes de descontinuá-las.
3. **Não misturar interface com transporte:** componentes não precisam conhecer a URL da HAFSQL nem acessar diretamente `window.hive_keychain`.
4. **Canais com ponto são distintos:** `hive.micro` e `hivemicro` nunca devem ser reunidos automaticamente.
5. **Isolar mudanças:** migrar uma feature por PR com testes, sem reescrever várias páginas de uma vez.

## Fases posteriores (após esta etapa)

- **Etapa 2 concluída parcialmente — Cache e sincronização:** extraídos `syncAndGetAuxData` e `fetchDataInLoopGeneric` de `js/api.js` para `js/data/sync.js`. `fetchData` ainda permanece no orquestrador. A etapa 3 implementou IndexedDB para snapshots de posts e deduplicação básica de operações, mas não migrou ainda o cache auxiliar de votos/mutes.
- **Etapa 3 — Features:** separar `features/channels`, `features/feed`, `features/threads` e `features/profile`, com adaptadores de compatibilidade.
- **Etapa 4 — UI:** dividir templates e estilos em componentes, sem alterar os payloads Hive.
- **Etapa 5 — Segurança e performance:** CSP, sanitização/DOM seguro, índices de replies e virtualização do feed, com testes específicos.

O backend `server.js` continua apenas servindo conteúdo estático, e não recebe chaves privadas.

## Etapa 3 — IndexedDB de publicações

Publicações públicas são persistidas em `micro-fair-posts`, versão 1, object store `feeds`. A chave é o ID completo do canal (`micro.fair`, `hive.micro`, etc.) e o valor é um snapshot do feed.

**Migração:** a primeira leitura verifica o snapshot em IndexedDB e a chave histórica `hiveAppPostsCache` ou `hiveAppChannelPosts_<id>`. Quando existe uma cópia antiga mais nova, ela é importada para IndexedDB. A cópia no `localStorage` é removida **somente após** a transação de gravação ter terminado. Se o navegador bloquear IndexedDB, o aplicativo continua lendo e gravando em `localStorage`.

**Privacidade:** apenas operações públicas são armazenadas nesse cache. O sistema não acessa nem guarda chaves privadas Hive.

**Deduplicação:** lotes da HAFSQL com IDs repetidos são consolidados por `custom_id + id`. Os identificadores de namespaces com ponto nunca são reduzidos ou unidos.

**Limites atuais:** 2.000 posts no feed principal e 1.000 por canal, mantendo a mesma quantidade visível que antes. Favoritos, configurações de usuário e cache auxiliar de votos/mutes permanecem no localStorage nesta etapa.

**Limpeza:** o comando de limpar cache aguarda apagar IndexedDB, remove os dados históricos de posts e apenas então recarrega a API.

**Validação necessária no navegador:** testar migração inicial com cache antigo, limpeza de cache, uso offline e publicação de novos posts. O conjunto automatizado usa um IndexedDB simulado, não um navegador real.

### Próximas etapas
- Indexar posts/respostas no estado para reduzir buscas de O(n²) na renderização.
- Migrar, se necessário, votos/mutes volumosos do localStorage para IndexedDB após testes de regressão.
- Extrair `fetchData` do orquestrador, mantendo compatibilidade com as rotas.
