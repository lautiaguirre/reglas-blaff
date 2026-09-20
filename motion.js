/* Animate the original vector artwork; the static images are the fallback. */
(() => {
  "use strict";

  const render = document.querySelector(".rules-render");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  if (!render || !Element.prototype.animate || !window.IntersectionObserver) return;

  const ns = "http://www.w3.org/2000/svg";
  const ease = getComputedStyle(document.documentElement)
    .getPropertyValue("--ease-out").trim();
  const active = new Set();
  const scenes = new Map();
  let observer;
  let keyboardScroll = false;

  // Every arrival resolves to the unmodified artwork, with no persistent styles.
  const recipes = {
    sign: { from: "translateY(-16px) rotate(-3deg) scale(0.96)", duration: 640 },
    stamp: { from: "translateY(10px) rotate(4deg) scale(0.94)", duration: 460, delay: 90 },
    heading: { from: "translateY(9px)", duration: 440 },
    rule: { from: "scaleX(0.35)", duration: 480, delay: 60 },
    noteLeft: { from: "translateX(-10px) rotate(-3deg)", duration: 420 },
    noteRight: { from: "translateX(10px) rotate(3deg)", duration: 420, delay: 60 },
    arrowLeft: { from: "translate(7px, -5px) rotate(-12deg) scale(0.94)", duration: 400 },
    arrowRight: { from: "translate(-7px, -5px) rotate(12deg) scale(0.94)", duration: 400, delay: 60 },
    winner: { from: "scale(0.97)", duration: 460 },
    echoLeft: { from: "translateX(-32px)", duration: 660 },
    echoRight: { from: "translateX(32px)", duration: 660, delay: 55 },
    jokerTitle: { from: "translateY(14px) rotate(-2deg) scale(0.97)", duration: 620, delay: 100 },
    // Both halves of the character use the same translation and start time.
    // Rotation/scale here would introduce a seam between the two SVG pages.
    character: { from: "translateX(30px)", duration: 700, delay: 60 },
    warning: { from: "translateX(-18px)", duration: 480 },
    question: { from: "translateY(6px) scale(0.97)", duration: 400 },
  };

  function settle() {
    active.forEach((animation) => animation.cancel());
    active.clear();
  }

  function play(scene) {
    if (scene.played) return;
    scene.played = true;
    observer.unobserve(scene.trigger);
    if (reducedMotion.matches || document.hidden || keyboardScroll) return;

    // Restored scroll positions and fast jumps should land on readable content.
    const bounds = scene.trigger.getBoundingClientRect();
    if (bounds.bottom <= 0 || bounds.top < -bounds.height / 2) return;
    const startTime = document.timeline.currentTime;

    scene.parts.forEach(({ node, recipe }) => {
      const animation = node.animate([
        { opacity: 0, transform: recipe.from },
        { opacity: 1, transform: "none" },
      ], {
        duration: recipe.duration,
        delay: recipe.delay || 0,
        easing: ease,
        fill: "backwards",
      });
      animation.startTime = startTime;
      active.add(animation);
      animation.finished.then(() => {
        active.delete(animation);
        animation.cancel();
      }, () => active.delete(animation));
    });
  }

  function add(svg, id, sceneName, recipeName, trigger = false) {
    const artwork = svg.getElementById(id);
    if (!artwork) throw new Error(`Missing BLAFF artwork: ${id}`);
    // An outer group keeps any original SVG transforms intact.
    const wrapper = document.createElementNS(ns, "g");
    wrapper.setAttribute("class", "artwork-motion");
    wrapper.dataset.motion = recipeName;
    artwork.before(wrapper);
    wrapper.append(artwork);
    if (!scenes.has(sceneName)) scenes.set(sceneName, { parts: [], played: false });
    const scene = scenes.get(sceneName);
    scene.parts.push({ node: wrapper, recipe: recipes[recipeName] });
    if (trigger || !scene.trigger) scene.trigger = wrapper;
  }

  function prepare(pages) {
    const [intro, turn, joker, ending] = pages;
    add(intro, "Group 1000005755", "brand", "sign", true);
    ["Rectangle 49", "Rectangle 48", "reglas"].forEach((id) => add(intro, id, "brand", "stamp"));
    add(intro, "Comienzo del juego", "beginning", "heading", true);
    add(intro, "Vector 65", "beginning", "rule");
    add(intro, "Group 1000005904", "notes", "noteLeft", true);
    add(intro, "Group 1000005906", "notes", "noteRight");

    // Only headings and drawn arrows move. The rule text stays still.
    add(intro, "Group 1000005907", "turn", "heading");
    add(turn, "Group 1000005921", "outcomes", "arrowLeft", true);
    add(turn, "Group 1000005920", "outcomes", "arrowRight");
    add(turn, "Group 1000005916", "winner", "winner");
    add(turn, "Group 1000005907", "clarifications", "heading");

    // Exported text IDs contain legacy encoding. Select the three title layers
    // by their shared ASCII label, keeping the original paths untouched.
    const titleLayers = [...joker.querySelectorAll("g[id]")]
      .filter((node) => node.id.includes("Y el comod"));
    if (titleLayers.length !== 3) throw new Error("Missing BLAFF joker title layers");
    titleLayers.forEach((node, index) => {
      add(joker, node.id, "joker", ["echoLeft", "echoRight", "jokerTitle"][index], index === 2);
    });
    add(joker, "Group 1000005938", "joker", "character");
    add(ending, "Group 1000005938", "joker", "character");
    add(ending, "Group 1000005939", "warning", "warning");
    add(ending, "Group 1000005941", "question", "question");
    add(ending, "Group 1000005920", "jokerOutcomes", "arrowLeft", true);
    add(ending, "Group 1000005921", "jokerOutcomes", "arrowRight");
  }

  function namespaceIds(svg, pageIndex) {
    // Each export reuses the same clip ID. Inline SVG IDs are document-wide.
    const ids = new Map();
    svg.querySelectorAll("[id]").forEach((node, index) => {
      const replacement = `blaff-p${pageIndex}-${index}`;
      ids.set(node.id, replacement);
      node.id = replacement;
    });
    svg.querySelectorAll("*").forEach((node) => {
      [...node.attributes].forEach((attribute) => {
        if (!attribute.value.includes("url(#")) return;
        node.setAttribute(attribute.name, attribute.value.replace(
          /url\(#([^)]*)\)/g, (match, id) => ids.has(id) ? `url(#${ids.get(id)})` : match,
        ));
      });
    });
  }

  async function enhance() {
    const images = [...render.querySelectorAll("img")];
    try {
      const sources = await Promise.all(images.map(async (img) => {
        const response = await fetch(img.src, { cache: "force-cache", priority: "low" });
        if (!response.ok) throw new Error("Artwork unavailable");
        return response.text();
      }));
      const pages = [];
      // Large original exports are prepared in separate tasks so a slower
      // phone can keep painting and responding between pages.
      for (const source of sources) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
        if (parsed.querySelector("parsererror")) throw new Error("Invalid artwork");
        const svg = document.importNode(parsed.documentElement, true);
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        pages.push(svg);
      }
      prepare(pages);
      for (const [index, svg] of pages.entries()) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        namespaceIds(svg, index);
      }

      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) play(scenes.get(entry.target.dataset.scene));
        });
      }, { rootMargin: "0px 0px 4% 0px", threshold: 0 });

      // Swap atomically, only after all artwork and references are ready.
      // The reserved image dimensions and SVG viewBoxes are identical.
      render.replaceChildren(...pages);
      scenes.forEach((scene, name) => {
        scene.trigger.dataset.scene = name;
        const bounds = scene.trigger.getBoundingClientRect();
        // Give the first viewport one focal entrance. Already visible reading
        // content (including browser-restored positions) needs no reveal.
        if (name !== "brand" && bounds.top < innerHeight && bounds.bottom > 0) {
          scene.played = true;
          return;
        }
        observer.observe(scene.trigger);
      });
      render.dataset.enhanced = "true";
    } catch {
      settle();
      observer?.disconnect();
      // Network, parsing or browser failure must never hide the rules.
      render.replaceChildren(...images);
    }
  }

  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) settle();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) settle();
  });
  window.addEventListener("pagehide", settle);
  document.addEventListener("keydown", (event) => {
    if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) {
      keyboardScroll = true;
      settle();
    }
  });
  const resumePointer = () => { keyboardScroll = false; };
  window.addEventListener("pointerdown", resumePointer, { passive: true });
  window.addEventListener("wheel", resumePointer, { passive: true });

  // The reduced-motion experience uses the original, immediately readable art.
  // If that preference changes later, enhance once with the same fallback.
  if (reducedMotion.matches) {
    reducedMotion.addEventListener("change", enhance, { once: true });
  } else {
    enhance();
  }
})();
