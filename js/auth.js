// /js/auth.js

// Função de Callback (será fornecida pelo app.js)
let onLoginSuccessCallback = () => {};
let onLogoutSuccessCallback = () => {};

export function setAuthCallbacks(loginCb, logoutCb) {
    onLoginSuccessCallback = loginCb;
    onLogoutSuccessCallback = logoutCb;
}

export function updateLoginUI() {
    const user = localStorage.getItem("hiveUser");
    const label = document.getElementById("menuUserLabel");
    const btnLogin = document.getElementById("menuLogin");
    const btnLogout = document.getElementById("menuLogout");
    const linkProfile = document.getElementById("menuProfile");

    const linkFollowed = document.getElementById("navFollowedLink");

    if (user) {
        label.textContent = "@" + user;
        btnLogin.classList.add("hidden");
        btnLogout.classList.remove("hidden");
        if (linkProfile) linkProfile.classList.remove("hidden");
        if (linkFollowed) linkFollowed.classList.remove("hidden");
    } else {
        label.textContent = "Login";
        btnLogin.classList.remove("hidden");
        btnLogout.classList.add("hidden");
        if (linkProfile) linkProfile.classList.add("hidden");
        if (linkFollowed) linkFollowed.classList.add("hidden");
    }
}

function handleLogin() {
    const username = document
        .getElementById("loginUsername")
        .value.trim()
        .toLowerCase();
    if (!username) return showNotification("⚠️ Digite seu usuário Hive!", false);
    if (!window.hive_keychain) return showNotification("❌ Hive Keychain não detectado!", false);

    window.hive_keychain.requestSignBuffer(
        username,
        "Login micro.feed",
        "Posting",
        (res) => {
            if (res.success) {
                localStorage.setItem("hiveUser", username);
                document.getElementById("loginModal").classList.add("hidden");
                updateLoginUI();
                showNotification("✅ Login bem-sucedido como @" + username, true);
                onLoginSuccessCallback(username); // Chama o callback no app.js
            } else {
                showNotification("❌ Falha no login via Keychain.", false);
            }
        }
    );
}
function handleLogoutConfirmation() {
    document.getElementById("userMenuDropdown").classList.add("hidden");
    // ID 'logoutConfirmModal' deve ser o container do seu novo modal no HTML
    document.getElementById("logoutConfirmModal").classList.remove("hidden");
}

// NOVO: Essa função executa o logout definitivo.
function finalizeLogout() {
    localStorage.removeItem("hiveUser");
    updateLoginUI();
    onLogoutSuccessCallback(); // Chama o callback no app.js
    document.getElementById("logoutConfirmModal").classList.add("hidden");
}
export function setupAuthListeners() {
    // Dropdown
    document.getElementById("btnMenu").addEventListener("click", () => {
        document.getElementById("userMenuDropdown").classList.toggle("hidden");
    });
    document.addEventListener("click", (e) => {
        if (
            !e.target.closest("#btnMenu") &&
            !e.target.closest("#userMenuDropdown")
        ) {
            document.getElementById("userMenuDropdown").classList.add("hidden");
        }
    });

    // Login/Logout Buttons
    document.getElementById("menuLogin").addEventListener("click", () => {
        document.getElementById("loginModal").classList.remove("hidden");
        document.getElementById("userMenuDropdown").classList.add("hidden");
    });

    document.getElementById("menuLogout").addEventListener("click", handleLogoutConfirmation);

    // Modal
    document
        .getElementById("closeLoginModal")
        .addEventListener("click", () => {
            document.getElementById("loginModal").classList.add("hidden");
        });

    document
        .getElementById("confirmLogin")
        .addEventListener("click", handleLogin);
    // NOVO: Listeners para o Modal de Confirmação de Logout
    const logoutModal = document.getElementById("logoutConfirmModal");
    
    // ATUALIZADO: Botão 'Sair' do modal chama a lógica final
    if (document.getElementById("confirmLogout")) {
        document.getElementById("confirmLogout").addEventListener("click", finalizeLogout);
    }
    
    // ATUALIZADO: Botão 'Cancelar' do modal o esconde
    if (document.getElementById("cancelLogout")) {
        document.getElementById("cancelLogout").addEventListener("click", () => {
            if (logoutModal) logoutModal.classList.add("hidden");
        });
    }
    
    // Opcional: Fechar o modal de logout ao clicar fora
    if (logoutModal) {
        logoutModal.addEventListener('click', (e) => {
            if (e.target.id === 'logoutConfirmModal') {
                logoutModal.classList.add("hidden");
            }
        });
    }

    updateLoginUI();
}

export function showNotification(message, isSuccess = true) {
    // 1. Cria o container (se não existir)
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        // Estilos para o container (posiciona no canto superior direito)
        container.className = 'fixed top-4 right-4 z-[90] flex flex-col gap-2';
        document.body.appendChild(container);
    }
    
    // 2. Cria a notificação
    const notification = document.createElement('div');
    const baseClasses = 'p-3 rounded-lg shadow-lg text-sm transition-opacity duration-300';
    
    if (isSuccess) {
        notification.className = `${baseClasses} bg-green-500 text-white`;
    } else {
        notification.className = `${baseClasses} bg-red-600 text-white`;
    }
    
    notification.textContent = message;
    container.appendChild(notification);
    
    // 3. Oculta após 4 segundos
    setTimeout(() => {
        notification.classList.remove('opacity-100');
        notification.classList.add('opacity-0');
        // Remove do DOM após a transição
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 4000);
}