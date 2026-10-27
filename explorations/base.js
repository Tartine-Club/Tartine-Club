const calme = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Section background follows the section crossing the middle of the screen
const fonds = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) document.body.style.setProperty("--bg", e.target.dataset.bg);
}, { rootMargin: "-50% 0px -50% 0px" });
document.querySelectorAll("[data-bg]").forEach((s) => fonds.observe(s));

// Tartine: leaves #depart, follows the scroll, lands jam side up on #atterrissage
const tartine = document.getElementById("tartine-voyage");
const depart = document.getElementById("depart");
const arrivee = document.getElementById("atterrissage");
function centre(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2 + scrollX, y: r.top + r.height / 2 + scrollY };
}
let posee = false;
function voyage() {
  const a = centre(depart), b = centre(arrivee);
  const w = tartine.offsetWidth, h = tartine.offsetHeight;
  // starts where #depart sits on screen, then eases to 45% of the viewport height
  const s = Math.min(1, scrollY / innerHeight);
  const y = calme ? b.y : Math.min(scrollY + a.y * (1 - s) + innerHeight * 0.45 * s, b.y);
  const p = Math.max(0, (y - a.y) / (b.y - a.y || 1));
  const x = a.x + (b.x - a.x) * p + Math.sin(p * Math.PI * 3) * innerWidth * 0.18 * (1 - p);
  const tours = (1 - p) * 720; // ends on a multiple of 360: always lands the right way up
  tartine.style.transform = `translate(${x - w / 2}px, ${y - h / 2}px) rotate(${tours}deg)`;
  if (p >= 1 && !posee) tartine.classList.add("is-posee");
  if (p < 1) tartine.classList.remove("is-posee");
  posee = p >= 1;
}
if (tartine) {
  addEventListener("scroll", () => requestAnimationFrame(voyage), { passive: true });
  addEventListener("resize", voyage);
  addEventListener("load", voyage);
  voyage();
}

// Stickers can be peeled off and moved around
document.querySelectorAll(".sticker").forEach((s) => {
  s.draggable = false;
  s.addEventListener("pointerdown", (e) => {
    const x0 = e.clientX - (parseFloat(s.dataset.dx) || 0), y0 = e.clientY - (parseFloat(s.dataset.dy) || 0);
    s.setPointerCapture(e.pointerId); s.classList.add("is-dragging");
    const move = (m) => {
      s.dataset.dx = m.clientX - x0; s.dataset.dy = m.clientY - y0;
      s.style.translate = `${s.dataset.dx}px ${s.dataset.dy}px`;
    };
    s.addEventListener("pointermove", move);
    s.addEventListener("pointerup", () => {
      s.removeEventListener("pointermove", move); s.classList.remove("is-dragging");
      // squash as it lands back on the table (Web Animations ignore the CSS reduced-motion rule)
      if (!calme) s.animate([{ scale: "1.15 .85" }, { scale: "1" }], { duration: 350, easing: "cubic-bezier(.3, 1.6, .5, 1)" });
    }, { once: true });
  });
});
