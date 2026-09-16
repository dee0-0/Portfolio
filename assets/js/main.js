import Lenis from "lenis";

const root = document.documentElement;
const film = document.querySelector("#scroll-film");
const menuButton = document.querySelector(".menu-toggle");
const siteNav = document.querySelector("#site-nav");
const sectionNodes = [...document.querySelectorAll("[data-section]")];
const sceneNodes = [...document.querySelectorAll(".track-section, .scene")];
const railLinks = [...document.querySelectorAll("[data-rail]")];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (start, end, amount) => start + (end - start) * amount;

let lenis = null;
let filmDuration = 15;
let targetFilmTime = 0;
let smoothFilmTime = 0;
let lastFilmWrite = 0;
let frameRequested = false;

function createLenis() {
  if (reduceMotion.matches || lenis) return;
  lenis = new Lenis({
    duration: 1.05,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    syncTouch: false,
    wheelMultiplier: 0.9,
  });
  const lenisFrame = (time) => {
    lenis?.raf(time);
    requestAnimationFrame(lenisFrame);
  };
  requestAnimationFrame(lenisFrame);
  lenis.on("scroll", requestFrame);
}

function destroyLenis() {
  lenis?.destroy();
  lenis = null;
}

function documentProgress() {
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  return clamp(window.scrollY / max);
}

function sceneProgress(node) {
  const rect = node.getBoundingClientRect();
  const range = Math.max(1, rect.height - window.innerHeight);
  return clamp(-rect.top / range);
}

function setSceneProgress() {
  for (const node of sceneNodes) node.style.setProperty("--p", sceneProgress(node).toFixed(4));
}

function setActiveChapter() {
  const marker = window.innerHeight * 0.46;
  let active = sectionNodes[0]?.dataset.section ?? "top";
  for (const section of sectionNodes) {
    const rect = section.getBoundingClientRect();
    if (rect.top <= marker && rect.bottom > marker) {
      active = section.dataset.section;
      break;
    }
  }
  for (const link of railLinks) link.classList.toggle("is-active", link.dataset.rail === active);
}

function writeFilmTime(now) {
  if (!film || reduceMotion.matches || film.readyState < 1) return;
  smoothFilmTime = lerp(smoothFilmTime, targetFilmTime, 0.105);
  if (Math.abs(smoothFilmTime - targetFilmTime) < 0.012) smoothFilmTime = targetFilmTime;
  if (now - lastFilmWrite > 34 && Math.abs(film.currentTime - smoothFilmTime) > 0.025) {
    film.currentTime = clamp(smoothFilmTime, 0, Math.max(0, filmDuration - 0.045));
    lastFilmWrite = now;
  }
}

function update(now = performance.now()) {
  frameRequested = false;
  const progress = documentProgress();
  root.style.setProperty("--scroll-progress", progress.toFixed(5));
  targetFilmTime = progress * Math.max(0, filmDuration - 0.045);
  setSceneProgress();
  setActiveChapter();
  writeFilmTime(now);
  if (!reduceMotion.matches && Math.abs(smoothFilmTime - targetFilmTime) > 0.014) requestFrame();
}

function requestFrame() {
  if (frameRequested) return;
  frameRequested = true;
  requestAnimationFrame(update);
}

function prepareFilm() {
  if (!film) return;
  film.muted = true;
  film.pause();
  const ready = () => {
    if (Number.isFinite(film.duration) && film.duration > 0) filmDuration = film.duration;
    film.pause();
    smoothFilmTime = documentProgress() * Math.max(0, filmDuration - 0.045);
    targetFilmTime = smoothFilmTime;
    if (!reduceMotion.matches) film.currentTime = smoothFilmTime;
    requestFrame();
  };
  if (film.readyState >= 1) ready();
  else film.addEventListener("loadedmetadata", ready, { once: true });
  film.addEventListener("play", () => film.pause());
}

function setMenu(open) {
  menuButton?.setAttribute("aria-expanded", String(open));
  menuButton?.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  siteNav?.classList.toggle("is-open", open);
  document.body.classList.toggle("menu-open", open);
}

menuButton?.addEventListener("click", () => setMenu(menuButton.getAttribute("aria-expanded") !== "true"));

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || menuButton?.getAttribute("aria-expanded") !== "true") return;
  setMenu(false);
  menuButton?.focus();
});

for (const anchor of document.querySelectorAll('a[href^="#"]')) {
  anchor.addEventListener("click", (event) => {
    const selector = anchor.getAttribute("href");
    if (!selector || selector === "#") return;
    const target = document.querySelector(selector);
    if (!target) return;
    event.preventDefault();
    setMenu(false);
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.15 });
    else target.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth" });
  });
}

const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    }
  },
  { threshold: 0.22, rootMargin: "0px 0px -8% 0px" },
);

for (const node of document.querySelectorAll(".reveal")) revealObserver.observe(node);

function updateBernTime() {
  const value = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  for (const node of document.querySelectorAll("[data-local-time]")) node.textContent = value;
}

updateBernTime();
setInterval(updateBernTime, 30_000);

reduceMotion.addEventListener("change", () => {
  if (reduceMotion.matches) {
    destroyLenis();
    film?.pause();
    if (film?.readyState >= 1) film.currentTime = 0;
  } else {
    createLenis();
    requestFrame();
  }
});

window.addEventListener("scroll", requestFrame, { passive: true });
window.addEventListener("resize", requestFrame, { passive: true });

prepareFilm();
createLenis();
setMenu(false);

const ready = document.fonts?.ready ?? Promise.resolve();
Promise.race([ready, new Promise((resolve) => setTimeout(resolve, 700))]).then(() => {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.classList.add("is-ready");
    setTimeout(() => root.classList.remove("js", "is-ready"), 1900);
  }));
});

requestFrame();
