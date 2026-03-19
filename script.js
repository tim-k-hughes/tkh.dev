const setCurrentYear = () => {
  document.querySelectorAll("[data-year]").forEach((node) => {
    node.textContent = new Date().getFullYear();
  });
};

const setActiveNav = () => {
  const currentPath = window.location.pathname.replace(/index\.html$/, "");

  document.querySelectorAll("[data-nav]").forEach((link) => {
    const href = new URL(link.href).pathname.replace(/index\.html$/, "");
    const isHome = href === "/";
    const isActive = isHome ? currentPath === "/" : currentPath.startsWith(href);
    link.classList.toggle("is-active", isActive);
  });
};

const revealSections = () => {
  const elements = document.querySelectorAll("[data-reveal]");

  if (!("IntersectionObserver" in window)) {
    elements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.15,
      rootMargin: "0px 0px -30px 0px",
    }
  );

  elements.forEach((element) => observer.observe(element));
};

setCurrentYear();
setActiveNav();
revealSections();
