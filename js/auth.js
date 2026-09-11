// /js/auth.js

import { showNotification } from "./utils.js";

function toggleModal(modalId, show = true) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.toggle("hidden", !show); 
    }
}

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

    const navUserAvatar = document.getElementById("navUserAvatar");
    const composerAvatar = document.getElementById("composerAvatar");

    const activityLinks = [linkProfile, linkFollowed, linkMyVotes, linkMyComments, linkMyReplies];

    if (user) {
        if (label) label.textContent = "@" + user;
        if (btnLogin) btnLogin.classList.add("hidden");
        if (btnLogout) btnLogout.classList.remove("hidden");
        activityLinks.forEach(link => {
            if (link) link.classList.remove("hidden");
        });
        if (navUserAvatar) {
            navUserAvatar.innerHTML = `<img src="https://images.hive.blog/u/${user}/avatar" alt="@${user}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 48 48\\'><rect width=\\'48\\' height=\\'48\\' fill=\\'%23ffd600\\'/><text x=\\'24\\' y=\\'32\\' font-size=\\'24\\' text-anchor=\\'middle\\'>🐝</text></svg>'">`;
        }
        if (composerAvatar) {
            composerAvatar.innerHTML = `<img src="https://images.hive.blog/u/${user}/avatar" alt="@${user}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 48 48\\'><rect width=\\'48\\' height=\\'48\\' fill=\\'%23ffd600\\'/><text x=\\'24\\' y=\\'32\\' font-size=\\'24\\' text-anchor=\\'middle\\'>🐝</text></svg>'">`;
        }
    } else {
        if (label) label.textContent = "Login";
        if (btnLogin) btnLogin.classList.remove("hidden");
        if (btnLogout) btnLogout.classList.add("hidden");
        activityLinks.forEach(link => {
            if (link) link.classList.add("hidden");
        });
        if (navUserAvatar) navUserAvatar.textContent = "🐝";
        if (composerAvatar) composerAvatar.textContent = "🐝";
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
                onLoginSuccessCallback(username);
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

function finalizeLogout() {
    localStorage.removeItem("hiveUser");
    updateLoginUI();
    onLogoutSuccessCallback();
    toggleModal("logoutConfirmModal", false);
}

function setupDropdownListeners() {
    const menuDropdown = document.getElementById("userMenuDropdown");
    const btnMenu = document.getElementById("btnMenu");
    
    if (btnMenu && menuDropdown) {
        btnMenu.addEventListener("click", (e) => {
            e.stopPropagation();
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
}

function setupLoginModalListeners() {
    const menuLogin = document.getElementById("menuLogin");
    if (menuLogin) {
        menuLogin.addEventListener("click", () => {
            toggleModal("loginModal", true);
            toggleModal("userMenuDropdown", false);
        });
    }

    const closeLoginModal = document.getElementById("closeLoginModal");
    if (closeLoginModal) {
        closeLoginModal.addEventListener("click", () => {
            toggleModal("loginModal", false);
        });
    }

    const confirmLogin = document.getElementById("confirmLogin");
    if (confirmLogin) {
        confirmLogin.addEventListener("click", handleLogin);
    }

    const loginModal = document.getElementById("loginModal");
    if (loginModal) {
        loginModal.addEventListener("click", (e) => {
            if (e.target.id === "loginModal") {
                toggleModal("loginModal", false);
            }
        });
    }
}

function setupLogoutModalListeners() {
    const menuLogout = document.getElementById("menuLogout");
    if (menuLogout) {
        menuLogout.addEventListener("click", handleLogoutConfirmation);
    }

    const logoutModal = document.getElementById("logoutConfirmModal");
    
    if (document.getElementById("confirmLogout")) {
        document.getElementById("confirmLogout").addEventListener("click", finalizeLogout);
    }
    
    if (document.getElementById("cancelLogout")) {
        document.getElementById("cancelLogout").addEventListener("click", () => {
            toggleModal("logoutConfirmModal", false);
        });
    }
    
    if (logoutModal) {
        logoutModal.addEventListener('click', (e) => {
            if (e.target.id === 'logoutConfirmModal') {
                toggleModal("logoutConfirmModal", false);
            }
        });
    }
}

export function setupAuthListeners() {
    setupDropdownListeners();
    setupLoginModalListeners();
    setupLogoutModalListeners();
    
    updateLoginUI();
}
