# Auditoria de segurança — Micro.fair (novembro de 2026)

Escopo: frontend ativo de `faireye-hive/microblog`, armazenamento público e interpretação de operações Hive `custom_json`. Este documento acompanha a primeira rodada de correções; não representa um pentest completo do navegador, da Keychain ou do indexador HAFSQL.

## Modelo de ameaça

- Posts, respostas, tags, IDs, metadados de canais, avatares e links recebidos da HAFSQL são **dados não confiáveis**, ainda que estejam gravados permanentemente na blockchain.
- Um usuário pode publicar operações usando `custom_id` idêntico ao de uma função administrativa. **Esse ID não concede autoridade.** Verificar a conta assinante é essencial.
- `localStorage.hiveUser` indica o nome da conta para exibição, não é prova de autorização. Assinaturas das operações são solicitadas à Hive Keychain.
- O registro de canais `micro.fair.channels` é público. O direito de atualizar seus metadados é uma regra do **cliente**, não uma restrição imposta pela blockchain Hive.

## Achados e ações

| Gravidade | Achado | Correção |
|---|---|---|
| Alta | Atributos HTML e URLs interpolados a partir de operações públicas no feed e em perfis | `safeExternalUrl`, `escapeAttr`, `escapeHtml`, validação de usernames/tags |
| Alta | `processMuteData` aceitava operações sem verificar se o assinante era `ADMIN` | Processador puro em `js/hive/moderation.js`, exige `custom_id` correto e assinatura do administrador |
| Alta | Qualquer registrante podia substituir o nome/descrição de canal existente com mesmo ID | Primeiro assinante do registro é tratado como titular; atualizações de terceiros são ignoradas no cliente |
| Média | Nomes vindos do cache local e metadados de tendências podiam chegar ao `innerHTML` sem escaping completo | Validação e renderização de texto seguro; proteção para JSON malformado |
| Média | Eventos HTML embutidos (`onclick`, `onerror`) prejudicavam defesa em profundidade | Substituídos por listeners JavaScript e fallbacks de imagem sem script inline |
| Média | Imagem aberta em modal era atribuída sem validação contextual | Apenas URLs externas HTTP/HTTPS previamente validadas |
| Baixa | Seletor de popover era construído com string vinda de atributo | Substituído por comparação de `dataset.author` |

## Verificações automatizadas

`npm test` cobre URLs perigosas e atributos, imagens, nomes de conta, campos malformados, assinatura de mute/unmute, substituição indevida de canais e saída HTML.

## Etapa posterior: CSP restritiva (PR de CSP)

A CSP foi adicionada em `index.html`, `404.html` e no cabeçalho do Express. Scripts são restritos a `'self'`, sem `unsafe-inline` e sem `unsafe-eval`. A lista de conexões de rede é restrita à origem do aplicativo e à HAFSQL. O Express também envia cabeçalhos de privacidade. Consulte [CSP e proxy de imagens](csp.md) para fontes permitidas, limitações e o checklist de validação da Hive Keychain.

**Atenção:** a compatibilidade com extensões reais ainda exige teste em navegador antes de tratar a CSP como validada funcionalmente.

## Limitações e itens pendentes

1. **CSP (Content Security Policy):** não habilitamos uma política agressiva às cegas. Precisamos validar no navegador a compatibilidade com a injeção/ponte do Hive Keychain, fontes externas e RPCs para evitar bloquear login e publicações. O trabalho de remoção de scripts inline prepara esse passo.
2. **Verificação blockchain independente:** o cliente confia que a HAFSQL entrega `required_posting_auths` e `custom_id` corretamente. Um indexador comprometido exige verificação adicional por RPC assinado ou prova de operação no bloco.
3. **Registro de canais:** a regra de primeiro criador é aplicada na visualização local. Não impede que outra conta emita operações de mesmo ID; versões futuras poderiam formalizar atualizações com ações tipadas ou políticas de propriedade.
4. **Login:** o nome em `localStorage` não substitui autenticação real. Se o app ganhar backend autenticado, será necessário desafio com nonce, data de expiração e verificação do lado servidor. Nunca guardar chaves privadas.
5. **Browser tests:** executar manualmente posts com imagens, Markdown, links, canais, perfis, threads, votos/mutes, Keychain e cache IndexedDB. Testes Node não substituem validação no Firefox e Chromium.
6. **Privacidade:** URLs de imagens e previews externas ainda solicitam conteúdo de terceiros e podem revelar IP ou referer. Uma política de referrer e proxy de mídia merecem revisão futura.
7. **Arquivos antigos:** `js/app1.js` e `js/app_backup.js` existem no repositório, mas não são carregados no `index.html` atual. Recomenda-se removê-los da publicação após confirmar que não são usados.
8. **Auditoria dinâmica:** ainda falta executar scanner de dependências, testes do servidor Express em produção, fuzzing mais abrangente e testes reais de navegador.

## Convenções para novas implementações

- Dados em texto: usar `textContent` ou `escapeHtml` em templates.
- Valores de atributos: usar `setAttribute` / DOM APIs ou `escapeAttr`.
- Links/imagens externas: validar com `safeExternalUrl` e só depois escapar para o atributo HTML.
- Não usar `onclick=`, `onerror=` ou `eval` em templates.
- Não usar `custom_id` como autorização; verificar o assinante e o tipo da operação.
- Preservar os pontos de IDs como `hive.micro`; nunca mesclar `hive.micro` e `hivemicro`.
