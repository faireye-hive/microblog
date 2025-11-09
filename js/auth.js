// /js/auth.js

import { showNotification } from "./utils.js";

function toggleModal(modalId, show = true) {
    const modal = document.getElementById(modalId);
    if (modal) {
        // Usa .toggle para adicionar/remover a classe "hidden"
        modal.classList.toggle("hidden", !show); 
    }
}
//

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
    const linkMyVotes = document.getElementById("menuMyVotes"); 
    const linkMyComments = document.getElementById("menuMyComments"); 
    const linkMyReplies = document.getElementById("menuMyReplies");

    const activityLinks = [linkProfile, linkFollowed, linkMyVotes, linkMyComments, linkMyReplies];

    if (user) {
        label.textContent = "@" + user;
        btnLogin.classList.add("hidden");
        btnLogout.classList.remove("hidden");
        activityLinks.forEach(link => {
            if (link) link.classList.remove("hidden"); //
        });
    } else {
        label.textContent = "Login";
        btnLogin.classList.remove("hidden");
        btnLogout.classList.add("hidden");
        activityLinks.forEach(link => {
            if (link) link.classList.add("hidden"); //
        });
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
                toggleModal("loginModal", false);
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
    toggleModal("userMenuDropdown", false);
    toggleModal("logoutConfirmModal", true);
}

// NOVO: Essa função executa o logout definitivo.
function finalizeLogout() {
    localStorage.removeItem("hiveUser");
    updateLoginUI();
    onLogoutSuccessCallback(); // Chama o callback no app.js
    toggleModal("logoutConfirmModal", false);
}

// Opcional: Abstrai a lógica de dropdown do menu principal
function setupDropdownListeners() {
    const menuDropdown = document.getElementById("userMenuDropdown");
    
    document.getElementById("btnMenu").addEventListener("click", () => {
        menuDropdown.classList.toggle("hidden");
    });
    document.addEventListener("click", (e) => {
        if (
            !e.target.closest("#btnMenu") &&
            !e.target.closest("#userMenuDropdown")
        ) {
            menuDropdown.classList.add("hidden");
        }
    });
}

function setupLoginModalListeners() {
    document.getElementById("menuLogin").addEventListener("click", () => {
        toggleModal("loginModal", true);
        toggleModal("userMenuDropdown", false); // Garante que o dropdown feche
    });

    document.getElementById("closeLoginModal").addEventListener("click", () => {
        toggleModal("loginModal", false);
    });

    document
        .getElementById("confirmLogin")
        .addEventListener("click", handleLogin);
}

function setupLogoutModalListeners() {
    document.getElementById("menuLogout").addEventListener("click", handleLogoutConfirmation);

    const logoutModal = document.getElementById("logoutConfirmModal");
    
    if (document.getElementById("confirmLogout")) {
        document.getElementById("confirmLogout").addEventListener("click", finalizeLogout);
    }
    
    if (document.getElementById("cancelLogout")) {
        document.getElementById("cancelLogout").addEventListener("click", () => {
            toggleModal("logoutConfirmModal", false);
        });
    }
    
    // Opcional: Fechar o modal de logout ao clicar fora (já implementado, mas usando o helper)
    if (logoutModal) {
        logoutModal.addEventListener('click', (e) => {
            if (e.target.id === 'logoutConfirmModal') {
                toggleModal("logoutConfirmModal", false);
            }
        });
    }
}


// /js/auth.js (Função principal de Setup mais limpa)

export function setupAuthListeners() {
    setupDropdownListeners();
    setupLoginModalListeners();
    setupLogoutModalListeners();
    
    updateLoginUI();
}