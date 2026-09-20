"""Browser regression check: python tests/check_scroll_motion.py <site-url>.

Development only. Requires Python Playwright and its Chromium/WebKit browsers.
"""

import json
import sys

from playwright.sync_api import sync_playwright


INSTRUMENT = """(() => {
  window.motionLog = [];
  const animate = Element.prototype.animate;
  Element.prototype.animate = function(frames, options) {
    window.motionLog.push({recipe: this.dataset.motion, duration: options.duration});
    return animate.call(this, frames, options);
  };
})();"""


def check(browser_type, url):
    browser = browser_type.launch()
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        is_mobile=True, has_touch=True, device_scale_factor=3,
    )
    context.add_init_script(INSTRUMENT)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(url)
    page.wait_for_selector('.rules-render[data-enhanced="true"]', state="attached")
    page.wait_for_function("motionLog.length >= 6")
    page.wait_for_timeout(250)
    assert page.locator('[data-scene="notes"]').get_attribute("data-state") == "pending"
    assert not page.evaluate("motionLog.some(a => a.recipe === 'noteLeft')")

    # Cross every real viewport threshold, instead of jumping to the page end.
    scenes = page.locator(".motion-triggers > span").evaluate_all(
        "nodes => nodes.map(n => ({name:n.dataset.scene, top:n.getBoundingClientRect().top + scrollY}))"
    )
    for scene in scenes:
        if scene["name"] in ("brand", "beginning"):
            continue
        page.evaluate("y => scrollTo(0, y)", max(0, scene["top"] - 844 * 0.6))
        page.wait_for_function(
            "name => document.querySelector(`[data-scene='${name}']`).dataset.state === 'played'",
            arg=scene["name"],
        )
        if scene["name"] == "notes":
            assert page.evaluate("""() => {
              const animation = document.getAnimations().find(a => a.effect.target.dataset.motion === 'noteLeft');
              return animation && animation.effect.getTiming().duration >= 1100;
            }""")
    page.wait_for_timeout(1900)
    assert page.locator(".motion-pending").count() == 0
    assert page.evaluate("motionLog.length") == 22
    assert page.evaluate("document.getAnimations().filter(a => a.effect.target.dataset.motion).length") == 0
    assert page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")
    assert "Comienzo del juego" in page.locator("main").aria_snapshot()

    # A return trip must not restart the 22 individual artwork animations.
    for scene in reversed(scenes):
        page.evaluate("y => scrollTo(0, y)", max(0, scene["top"] - 300))
        page.wait_for_timeout(30)
    assert page.evaluate("motionLog.length") == 22

    # Rotating the viewport recalculates the activation line.
    page.goto(url)
    page.wait_for_selector('[data-enhanced="true"]', state="attached")
    page.set_viewport_size({"width": 844, "height": 390})
    page.wait_for_timeout(100)
    assert page.locator('[data-scene="notes"]').get_attribute("data-state") == "pending"
    note_top = page.locator('[data-scene="notes"]').evaluate("n => n.getBoundingClientRect().top + scrollY")
    page.evaluate("y => scrollTo(0, y)", note_top - 230)
    page.wait_for_function("motionLog.some(a => a.recipe === 'noteLeft')")

    # Changing the motion preference must reveal every pending piece immediately.
    page.emulate_media(reduced_motion="reduce")
    page.wait_for_function("document.querySelectorAll('.motion-pending').length === 0")
    assert page.evaluate("document.getAnimations().filter(a => a.effect.target.dataset.motion).length") == 0
    page.goto(url)
    assert page.locator(".rules-render > img").count() == 4
    assert page.locator(".motion-triggers").count() == 0

    # A failed progressive enhancement leaves the complete original images.
    page.emulate_media(reduced_motion="no-preference")
    page.route("**/assets/rules-page-*.svg", lambda route:
               route.abort() if route.request.resource_type == "fetch" else route.continue_())
    page.goto(url)
    page.wait_for_function("[...document.querySelectorAll('.rules-render > img')].every(n => n.complete && n.naturalWidth > 0)")
    assert page.locator(".rules-render > img").count() == 4
    assert page.locator(".motion-pending").count() == 0
    assert not errors, errors
    context.close()

    fallback = browser.new_context(java_script_enabled=False)
    static = fallback.new_page()
    static.goto(url)
    assert static.locator(".rules-render > img").count() == 4
    fallback.close()
    browser.close()
    return {"engine": browser_type.name, "result": "passed", "scenes": len(scenes), "artwork_animations": 22}


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python tests/check_scroll_motion.py <site-url>")
    with sync_playwright() as playwright:
        for engine in (playwright.chromium, playwright.webkit):
            print(json.dumps(check(engine, sys.argv[1])), flush=True)
