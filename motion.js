const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const animatedCrops = new WeakSet();
const rootStyles = getComputedStyle(document.documentElement);
const easeOut = rootStyles.getPropertyValue("--ease-out").trim();
const easeInOut = rootStyles.getPropertyValue("--ease-in-out").trim();

const motionRecipes = {
  "note-left": {
    keyframes: [
      { opacity: 0, transform: "translate3d(-18px, 8px, 0) rotate(-2deg) scale(0.96)" },
      { opacity: 1, transform: "translate3d(0, 0, 0) rotate(0) scale(1)" },
    ],
    duration: 520,
  },
  "note-right": {
    keyframes: [
      { opacity: 0, transform: "translate3d(18px, 8px, 0) rotate(2deg) scale(0.96)" },
      { opacity: 1, transform: "translate3d(0, 0, 0) rotate(0) scale(1)" },
    ],
    duration: 520,
    delay: 70,
  },
  title: {
    keyframes: [
      { opacity: 0, transform: "translate3d(0, 12px, 0)", clipPath: "inset(0 0 100% 0)" },
      { opacity: 1, transform: "translate3d(0, 0, 0)", clipPath: "inset(0 0 0 0)" },
    ],
    duration: 560,
  },
  "arrow-left": {
    keyframes: [
      { opacity: 0, transform: "translate3d(-16px, 0, 0) rotate(-8deg)" },
      { opacity: 1, transform: "translate3d(0, 0, 0) rotate(0)" },
    ],
    duration: 460,
  },
  "arrow-right": {
    keyframes: [
      { opacity: 0, transform: "translate3d(16px, 0, 0) rotate(8deg)" },
      { opacity: 1, transform: "translate3d(0, 0, 0) rotate(0)" },
    ],
    duration: 460,
    delay: 60,
  },
  joker: {
    keyframes: [
      { opacity: 0, transform: "translate3d(7%, 0, 0) scale(0.985)", clipPath: "inset(0 0 0 100%)" },
      { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)", clipPath: "inset(0 0 0 0)" },
    ],
    duration: 800,
    easing: easeInOut,
  },
  how: {
    keyframes: [
      { opacity: 0, transform: "translate3d(0, 14px, 0) scale(0.95)", filter: "blur(3px)" },
      { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)", filter: "blur(0)" },
    ],
    duration: 650,
  },
};

function playMotion(crop) {
  if (animatedCrops.has(crop)) return;
  animatedCrops.add(crop);

  const artwork = crop.querySelector("img");
  const recipe = motionRecipes[crop.dataset.motion];
  if (!artwork || !recipe) return;

  const keyframes = reducedMotion.matches
    ? [{ opacity: 0.72 }, { opacity: 1 }]
    : recipe.keyframes;

  artwork.animate(keyframes, {
    duration: reducedMotion.matches ? 180 : recipe.duration,
    delay: reducedMotion.matches ? 0 : recipe.delay || 0,
    easing: recipe.easing || easeOut,
    fill: "none",
  });
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      playMotion(entry.target);
      observer.unobserve(entry.target);
    });
  },
  { rootMargin: "0px 0px -12%", threshold: 0.16 },
);

document
  .querySelectorAll('.motion-crop:not([data-motion="hero"])')
  .forEach((crop) => observer.observe(crop));

const progressBar = document.querySelector(".reading-progress span");
let progressFrame = 0;

function updateReadingProgress() {
  progressFrame = 0;
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0;
  progressBar.style.transform = `scaleX(${progress})`;
}

function queueReadingProgress() {
  if (progressFrame) return;
  progressFrame = window.requestAnimationFrame(updateReadingProgress);
}

window.addEventListener("scroll", queueReadingProgress, { passive: true });
window.addEventListener("resize", queueReadingProgress, { passive: true });
updateReadingProgress();
