#  micro.fair: Microblogging com Hive Keychain

O **micro.fair** é um projeto de microblogging que demonstra como construir uma aplicação web moderna e modular usando HTML, CSS (Tailwind CSS) e JavaScript puro (Vanilla JS), com autenticação descentralizada via **Hive Keychain**.

A principal arquitetura do projeto foca em separar as responsabilidades da interface, estado e lógica de negócio em módulos ES (`import`/`export`) bem definidos.

-----

## 🚀 Arquitetura e Modularização

O projeto utiliza o sistema de módulos JavaScript (ES Modules, `type="module"`) para garantir uma estrutura limpa e de fácil manutenção.

O ponto de entrada é o `app.js`, que atua como orquestrador, importando e coordenando a inicialização de todos os outros módulos.

### Estrutura de Arquivos

| Arquivo | Propósito | Responsabilidades Principais |
| :--- | :--- | :--- |
| `index.html` | Template Básico | Contém apenas o boilerplate HTML, links CSS e **pontos de montagem** (`<div id="navbar-root">`, etc.) para injeção de templates. |
| `js/app.js` | Orquestrador e Estado | Gerencia o estado global (`allPosts`), coordena as chamadas de API (`fetchPosts`, `sendPost`), configura a inicialização do DOM (`setupInitialDOM`) e a configuração dos Listeners (`setupEventListeners`). |
| `js/config.js` | Configuração Central | Define constantes essenciais do projeto que podem mudar, como o ID da aplicação (`APP_ID`) e a URL da API (`API_URL`). **Ponto único de alteração** para ambientes. |
| `js/auth.js` | Autenticação | Lógica de Login/Logout, comunicação com o Hive Keychain e manipulação do Modal de Login. |
| `js/render.js` | Renderização (UI) | Funções puras para transformar dados (posts, replies) em strings HTML (ex: `buildPostCard`, `buildRepliesRecursive`). Não manipula o DOM diretamente, apenas retorna o HTML. |
| `js/utils.js` | Utilitários/Helpers | Funções auxiliares para manipulação de strings, datas, parsing de JSON e extração de tags/menções do texto. |
| `js/templates.js` | Componentes HTML | Armazena o HTML de grandes blocos da interface (Navbar, Modais, Sidebar) como strings exportadas (`NavbarHTML`, `LoginModalHTML`). |

-----

## 🧩 Detalhes Técnicos e Fluxo de Dados

### 1\. Centralização de Configurações (`config.js`)

Decidiu-se centralizar as configurações vitais (`APP_ID`, `API_URL`) no `config.js`.

  * Qualquer alteração no `APP_ID` é propagada automaticamente para:
      * **`utils.js`**: Para montar a URL de busca de posts.
      * **`app.js`**: Para filtrar os posts corretos (`custom_id`) e para enviar as transações via Hive Keychain (ID da operação).

### 2\. Fluxo de Inicialização

O `app.js` segue uma ordem rigorosa para evitar erros de elementos nulos (`...is null`):

1.  `setupInitialDOM()`: Injeta todas as strings HTML dos templates (`templates.js`) nos seus respectivos pontos de montagem (`id-root`) no `index.html`.
2.  `setupEventListeners()`: Configura os listeners para elementos que foram injetados (`#btnPost`, `#btnRefresh`, etc.).
3.  `setupAuthListeners()`: Configura a lógica de autenticação (menu, modal).
4.  `fetchPosts()`: Inicia o carregamento dos dados da API.

### 3\. Renderização de Posts (`render.js`)

As funções de renderização recebem o estado global (`allPosts`) como argumento, garantindo que o HTML gerado esteja sempre sincronizado com os dados mais recentes.

  * `buildPostCard(p, allPosts)`: Monta o HTML de um post individual.
      * **Nova Estrutura UX:** Os botões de ação (`thread-btn`, `reply-btn`) foram movidos para a base do cartão (`Rodapé Fixo`), garantindo uma posição consistente, mesmo que o post contenha o bloco "Em resposta a...".
  * `buildThreadAbove(post, allPosts)`: **Exibe apenas a resposta imediata** (o post pai direto), resolvendo o problema de posts que empilhavam toda a cadeia de replies no topo do card.
  * `buildRepliesRecursive(parentId, allPosts)`: Responsável por renderizar a árvore de respostas abaixo de um post principal, usado tanto para expandir threads inline quanto para a visualização de thread única.

### 4\. Interação com o Feed (Event Delegation)

O `app.js` utiliza a técnica de *Event Delegation* na seção de Feed:

```javascript
document.getElementById("feed").addEventListener("click", (e) => { ... });
```

Isso garante que os ouvintes de eventos para replies e visualização de threads funcionem corretamente para posts que são carregados via scroll infinito (`renderNextBatch`) ou injetados dinamicamente no DOM, sem a necessidade de anexar listeners a cada novo post.

### 5\. Postagem e Blockchain

A função `sendPost` utiliza o objeto global `window.hive_keychain` para solicitar que o usuário assine uma transação `custom_json` com o ID definido em `APP_ID`. A chave usada para a assinatura é a **Posting Key**, garantindo que a chave Master do usuário permaneça segura.

-----

## 🛠️ Como Executar o Projeto

1.  **Clonar o Repositório:**
    ```bash
    git clone [SEU_REPOSITÓRIO]
    cd micro.feed
    ```
2.  **Instalar o Hive Keychain:** Certifique-se de ter a extensão do navegador Hive Keychain instalada e uma conta Hive configurada.
3.  **Servir Localmente:**
    Este projeto usa ES Modules (`import/export`) e requisições `fetch`. Para funcionar, ele deve ser servido por um servidor web local (não basta abrir o arquivo `index.html` diretamente).
      * **Opção 1 (Python):** Se você tem Python instalado:
        ```bash
        python3 -m http.server 5500
        ```
      * **Opção 2 (VS Code):** Use a extensão "Live Server".
4.  **Acessar:** Abra seu navegador em `http://localhost:5500`.

-----