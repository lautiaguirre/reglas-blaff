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
  let triggers;
  let resizeFrame = 0;

  // Every arrival resolves to the unmodified artwork, with no persistent styles.
  const recipes = {
    sign: { from: "translateY(-28px) rotate(-6deg) scale(0.93)", duration: 1300 },
    stamp: { from: "translateY(20px) rotate(8deg) scale(0.92)", duration: 1100, delay: 200 },
    heading: { from: "translateY(24px) scale(0.97)", duration: 1150 },
    rule: { from: "scaleX(0.2)", duration: 1100, delay: 180 },
    noteLeft: { from: "translate(-24px, 14px) rotate(-7deg)", duration: 1200 },
    noteRight: { from: "translate(24px, 14px) rotate(7deg)", duration: 1200, delay: 120 },
    arrowLeft: { from: "translate(12px, -12px) rotate(-20deg) scale(0.92)", duration: 1100 },
    arrowRight: { from: "translate(-12px, -12px) rotate(20deg) scale(0.92)", duration: 1100, delay: 120 },
    winner: { from: "translateY(14px) scale(0.94)", duration: 1200 },
    echoLeft: { from: "translate(-64px, -6px) rotate(-4deg)", duration: 1450 },
    echoRight: { from: "translate(64px, 6px) rotate(4deg)", duration: 1450, delay: 100 },
    jokerTitle: { from: "translateY(26px) rotate(-4deg) scale(0.94)", duration: 1500, delay: 180 },
    // Both halves of the character use the same translation and start time.
    // Rotation/scale here would introduce a seam between the two SVG pages.
    character: { from: "translateX(64px)", duration: 1600, delay: 140 },
    warning: { from: "translateX(-36px) rotate(-3deg)", duration: 1250 },
    question: { from: "translateY(22px) rotate(-3deg) scale(0.92)", duration: 1200 },
  };

  function reveal(scene) {
    scene.parts.forEach(({ node }) => node.classList.remove("motion-pending"));
  }

  function settle() {
    active.forEach((animation) => animation.cancel());
    active.clear();
  }

  function play(scene) {
    if (scene.played || document.hidden) return;
    scene.played = true;
    observer.unobserve(scene.trigger);
    scene.trigger.dataset.state = "played";
    if (reducedMotion.matches || keyboardScroll) {
      reveal(scene);
      return;
    }

    // Restored scroll positions and fast jumps should land on readable content.
    const bounds = scene.trigger.getBoundingClientRect();
    if (bounds.bottom <= 0) {
      reveal(scene);
      return;
    }
    const startTime = document.timeline.currentTime;

    try {
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
    } catch {
      settle();
    } finally {
      // Fill backwards supplies the first frame, including any stagger delay.
      // Always reveal if the browser rejects an individual animation.
      reveal(scene);
    }
  }

  function observeScenes() {
    if (!triggers) return;
    observer?.disconnect();
    // Percentage root margins use viewport WIDTH. Use visible viewport pixels
    // so mobile toolbars, rotation and narrow screens share the same trigger.
    const visibleHeight = window.visualViewport?.height || innerHeight;
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) play(scenes.get(entry.target.dataset.scene));
      });
    }, { rootMargin: `0px 0px -${Math.round(visibleHeight * 0.22)}px 0px`, threshold: 0 });
    scenes.forEach((scene) => {
      if (scene.played) return;
      if (scene.trigger.getBoundingClientRect().bottom <= 0 || reducedMotion.matches) {
        scene.played = true;
        scene.trigger.dataset.state = "played";
        reveal(scene);
      } else {
        observer.observe(scene.trigger);
      }
    });
  }

  function createTriggers(pages) {
    triggers = document.createElement("div");
    triggers.className = "motion-triggers";
    triggers.setAttribute("aria-hidden", "true");
    scenes.forEach((scene, name) => {
      const box = scene.trigger.getBBox();
      const pageIndex = pages.indexOf(scene.trigger.ownerSVGElement);
      const marker = document.createElement("span");
      marker.dataset.scene = name;
      marker.dataset.state = "pending";
      marker.style.top = `${pageIndex * 1182 + box.y + box.height * 0.4}px`;
      marker.style.left = `${Math.max(1, Math.min(400, box.x + box.width / 2))}px`;
      triggers.append(marker);
      scene.trigger = marker;
      scene.parts.forEach(({ node }) => node.classList.add("motion-pending"));
    });
    // HTML markers are stable across SVG clipping and CSS zoom in mobile
    // browsers, and their position never changes with the animated artwork.
    render.parentElement.append(triggers);
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

      // Swap atomically, only after all artwork and references are ready.
      // The reserved image dimensions and SVG viewBoxes are identical.
      render.replaceChildren(...pages);
      createTriggers(pages);
      render.dataset.enhanced = "true";
      observeScenes();
    } catch {
      settle();
      observer?.disconnect();
      triggers?.remove();
      triggers = null;
      delete render.dataset.enhanced;
      // Network, parsing or browser failure must never hide the rules.
      render.replaceChildren(...images);
    }
  }

  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) {
      settle();
      observeScenes();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) settle();
    else observeScenes();
  });
  window.addEventListener("pagehide", settle);
  window.addEventListener("pageshow", observeScenes);
  const resize = () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      observeScenes();
    });
  };
  window.addEventListener("resize", resize, { passive: true });
  window.visualViewport?.addEventListener("resize", resize, { passive: true });
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
