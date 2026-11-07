// Mobile navigation is intentionally independent from the data/feed modules.
// Its only job is to reflect the current hash route in the mobile tab bar.

export function getActiveMobileSection(hash = "#/") {
  const segment = String(hash).replace(/^#\/?/, "").split(/[/?]/, 1)[0].toLowerCase();

  switch (segment) {
    case "trending":
    case "explore":
    case "active":
    case "search":
      return "explore";
    case "channels":
    case "channel":
      return "channels";
    case "bookmarks":
      return "bookmarks";
    case "profile":
    case "user":
      return "profile";
    default:
      return "home";
  }
}

export function syncMobileNavigation() {
  if (typeof document === "undefined") return;
  const nav = document.getElementById("mobileBottomNav");
  if (!nav) return;

  const section = getActiveMobileSection(
    typeof window !== "undefined" ? window.location.hash : "#/"
  );

  nav.querySelectorAll("[data-mobile-section]").forEach((link) => {
    const active = link.dataset.mobileSection === section;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("hashchange", syncMobileNavigation);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncMobileNavigation, { once: true });
  } else {
    syncMobileNavigation();
  }
}
