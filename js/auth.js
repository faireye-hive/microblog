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

    if (user) {
        label.textContent = "@" + user;
        btnLogin.classList.add("hidden");
        btnLogout.classList.remove("hidden");
    } else {
        label.textContent = "Login";
        btnLogin.classList.remove("hidden");
        btnLogout.classList.add("hidden");
    }
}

function handleLogin() {
    const username = document
        .getElementById("loginUsername")
        .value.trim()
        .toLowerCase();
    if (!username) return alert("Digite seu usuário Hive!");
    if (!window.hive_keychain) return alert("Hive Keychain não detectado!");

    window.hive_keychain.requestSignBuffer(
        username,
        "Login micro.feed",
        "Posting",
        (res) => {
            if (res.success) {
                localStorage.setItem("hiveUser", username);
                document.getElementById("loginModal").classList.add("hidden");
                updateLoginUI();
                alert("✅ Login bem-sucedido como @" + username);
                onLoginSuccessCallback(); // Chama o callback no app.js
            } else {
                alert("❌ Falha no login via Keychain.");
            }
        }
    );
}

function handleLogout() {
    if (confirm("Deseja sair da conta?")) {
        localStorage.removeItem("hiveUser");
        updateLoginUI();
        onLogoutSuccessCallback(); // Chama o callback no app.js
    }
    document.getElementById("userMenuDropdown").classList.add("hidden");
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

    document.getElementById("menuLogout").addEventListener("click", handleLogout);

    // Modal
    document
        .getElementById("closeLoginModal")
        .addEventListener("click", () => {
            document.getElementById("loginModal").classList.add("hidden");
        });

    document
        .getElementById("confirmLogin")
        .addEventListener("click", handleLogin);

    updateLoginUI();
}