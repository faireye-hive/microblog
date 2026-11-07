// Hive Keychain authentication and accessible account UI.
// Auth data is verified when Keychain signs; this module never asks for keys.
import { showNotification } from "./utils.js";
import { safeHiveUsername, hiveAvatarUrl } from "./security/safe-values.js";
import { proxiedImageUrl } from "./security/media-url.js";

let onLoginSuccessCallback = () => {};
let onLogoutSuccessCallback = () => {};
let loginPending = false;

export function setAuthCallbacks(loginCb, logoutCb) {
    onLoginSuccessCallback = loginCb;
    onLogoutSuccessCallback = logoutCb;
}

function toggleModal(modalId, show = true) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.toggle("hidden", !show);
    if (modalId === "userMenuDropdown") {
        const trigger = document.getElementById("btnMenu");
        trigger?.setAttribute("aria-expanded", String(show));
    } else if (modalId === "loginModal" || modalId === "logoutConfirmModal") {
        if (show) {
            const focusTarget = modalId === "loginModal" ? "loginUsername" : "cancelLogout";
            document.getElementById(focusTarget)?.focus();
        } else {
            document.getElementById("btnMenu")?.focus();
        }
    }
}

function setLoginPending(pending) {
    loginPending = pending;
    const submit = document.getElementById("confirmLogin");
    const label = document.getElementById("loginSubmitLabel");
    const form = document.getElementById("loginForm");
    if (submit) submit.disabled = pending;
    if (label) label.textContent = pending ? "Waiting for Keychain…" : "Continue with Keychain";
    if (form) form.setAttribute("aria-busy", String(pending));
}

export function updateLoginUI() {
    const savedUser = localStorage.getItem("hiveUser");
    const user = savedUser && safeHiveUsername(savedUser) !== "unknown"
        ? safeHiveUsername(savedUser) : null;

    const btnLogin = document.getElementById("menuLogin");
    const btnLogout = document.getElementById("menuLogout");
    const activityLinks = ["menuProfile", "navFollowedLink", "menuMyVotes", "menuMyComments", "menuMyReplies"];
    const trigger = document.getElementById("btnMenu");
    const triggerLabel = document.getElementById("accountTriggerLabel");
    const guestIcon = document.getElementById("accountGuestIcon");
    const accountName = document.getElementById("accountMenuName");
    const accountStatus = document.getElementById("accountMenuStatus");
    const sectionLabel = document.getElementById("accountMenuSectionLabel");

    if (btnLogin) btnLogin.classList.toggle("hidden", Boolean(user));
    if (btnLogout) btnLogout.classList.toggle("hidden", !user);
    for (const id of activityLinks) {
        document.getElementById(id)?.classList.toggle("hidden", !user);
    }
    sectionLabel?.classList.toggle("hidden", !user);
    if (trigger) {
        trigger.dataset.authenticated = user ? "true" : "false";
        trigger.setAttribute("aria-label", user ? `Open account menu for @${user}` : "Sign in with Hive Keychain");
        trigger.setAttribute("aria-haspopup", user ? "true" : "false");
    }
    if (triggerLabel) triggerLabel.textContent = user ? `@${user}` : "Sign in";
    guestIcon?.classList.toggle("hidden", Boolean(user));
    if (accountName) accountName.textContent = user ? `@${user}` : "Your account";
    if (accountStatus) accountStatus.textContent = user ? "Connected to Hive" : "Sign in to post and connect";
    const profileLabel = document.getElementById("menuUserLabel");
    if (profileLabel) profileLabel.textContent = "My profile";

    const avatarUrl = proxiedImageUrl(hiveAvatarUrl(user || "hive"));
    const navAvatar = document.getElementById("navUserAvatar");
    if (navAvatar) {
        navAvatar.classList.toggle("hidden", !user);
        navAvatar.src = avatarUrl;
        navAvatar.alt = user ? `Avatar de @${user}` : "";
        navAvatar.dataset.avatarFallback = "user";
    }
    const composerAvatar = document.getElementById("composerAvatar");
    if (composerAvatar) {
        composerAvatar.src = avatarUrl;
        composerAvatar.alt = user ? `Avatar de @${user}` : "Avatar";
        composerAvatar.dataset.avatarFallback = "user";
    }
}

function handleLogin() {
    if (loginPending) return;
    const input = document.getElementById("loginUsername");
    const username = String(input?.value || "").trim().toLowerCase();
    if (!username) {
        input?.focus();
        return showNotification("Enter your Hive username.", false);
    }
    if (safeHiveUsername(username) !== username) {
        input?.focus();
        return showNotification("Invalid Hive username.", false);
    }
    if (!window.hive_keychain) {
        return showNotification("Hive Keychain was not detected. Please install or enable the extension.", false);
    }
    setLoginPending(true);
    try {
        window.hive_keychain.requestSignBuffer(
            username,
            "Login micro.feed",
            "Posting",
            (res) => {
                setLoginPending(false);
                if (res?.success) {
                    localStorage.setItem("hiveUser", username);
                    toggleModal("loginModal", false);
                    updateLoginUI();
                    showNotification("Signed in as @" + username, true);
                    onLoginSuccessCallback(username);
                } else {
                    showNotification("Keychain sign-in was not approved.", false);
                }
            }
        );
    } catch {
        setLoginPending(false);
        showNotification("Could not connect to Hive Keychain.", false);
    }
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

function keepFocusInDialog(modal, event) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(modal.querySelectorAll("button:not([disabled]), input:not([disabled]), a[href]"))
        .filter(element => !element.classList.contains("hidden"));
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

function setupDropdownListeners() {
    const menu = document.getElementById("userMenuDropdown");
    const trigger = document.getElementById("btnMenu");
    if (!menu || !trigger) return;
    trigger.addEventListener("click", event => {
        event.stopPropagation();
        if (trigger.dataset.authenticated !== "true") {
            toggleModal("userMenuDropdown", false);
            toggleModal("loginModal", true);
            return;
        }
        const open = menu.classList.contains("hidden");
        toggleModal("userMenuDropdown", open);
        if (open) menu.querySelector("a.dropdown-link:not(.hidden), button.dropdown-link:not(.hidden)")?.focus();
    });
    menu.querySelectorAll("a.dropdown-link").forEach(link => {
        link.addEventListener("click", () => toggleModal("userMenuDropdown", false));
    });
    document.addEventListener("click", event => {
        if (!event.target.closest("#btnMenu") && !event.target.closest("#userMenuDropdown")) {
            toggleModal("userMenuDropdown", false);
        }
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !menu.classList.contains("hidden")) {
            event.preventDefault();
            toggleModal("userMenuDropdown", false);
            trigger.focus();
        }
    });
}

function setupLoginModalListeners() {
    document.getElementById("menuLogin")?.addEventListener("click", () => {
        toggleModal("userMenuDropdown", false);
        toggleModal("loginModal", true);
    });
    document.getElementById("closeLoginModal")?.addEventListener("click", () => toggleModal("loginModal", false));
    document.getElementById("cancelLoginModal")?.addEventListener("click", () => toggleModal("loginModal", false));

    document.getElementById("loginForm")?.addEventListener("submit", event => {
        event.preventDefault();
        handleLogin();
    });

    const modal = document.getElementById("loginModal");
    modal?.addEventListener("click", event => {
        if (event.target === modal && !loginPending) toggleModal("loginModal", false);
    });
    modal?.addEventListener("keydown", event => {
        if (event.key === "Escape" && !loginPending) {
            event.preventDefault();
            toggleModal("loginModal", false);
        } else {
            keepFocusInDialog(modal, event);
        }
    });
}

function setupLogoutModalListeners() {
    document.getElementById("menuLogout")?.addEventListener("click", handleLogoutConfirmation);
    document.getElementById("confirmLogout")?.addEventListener("click", finalizeLogout);
    document.getElementById("cancelLogout")?.addEventListener("click", () => toggleModal("logoutConfirmModal", false));
    const modal = document.getElementById("logoutConfirmModal");
    modal?.addEventListener("click", event => {
        if (event.target === modal) toggleModal("logoutConfirmModal", false);
    });
    modal?.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            event.preventDefault();
            toggleModal("logoutConfirmModal", false);
        } else {
            keepFocusInDialog(modal, event);
        }
    });
}

export function setupAuthListeners() {
    setupDropdownListeners();
    setupLoginModalListeners();
    setupLogoutModalListeners();
    updateLoginUI();
}
