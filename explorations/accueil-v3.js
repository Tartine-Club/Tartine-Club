// Homepage animations, following the blue notes of the Figma "Accueil" (Wireframes V2 / 35:4)
const calme = matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v, a = 0, b = 100) => Math.min(b, Math.max(a, v));
gsap.registerPlugin(ScrollTrigger, SplitText);

// --- La carte is a fixed 1440px illustration: scale it down on narrower screens
const scene = document.getElementById("carte-scene"), carte = document.getElementById("carte");
function echelle() { const s = Math.min(1, innerWidth / 1440); scene.style.scale = s; carte.style.height = `${2794 * s}px`; }
echelle();
addEventListener("resize", () => { echelle(); ScrollTrigger.refresh(); });

// --- 01 Hero: letters drop in with a bounce, then the pills fall and stick on crooked
if (!calme) {
  const lettres = SplitText.create("#titre-hero", { type: "words,chars" }); // words keep letters from wrapping mid-word
  gsap.from(lettres.chars, { yPercent: -130, opacity: 0, duration: 1.1, ease: "bounce.out", stagger: 0.035 });
  gsap.from(".js-pastille", { y: -320, opacity: 0, rotation: 25, duration: 1, ease: "bounce.out", stagger: 0.18, delay: 0.9 });
}

// --- 02 Ribbon: always moving, faster while scrolling, reverses when scrolling up
const piste = document.getElementById("ruban");
let x = 0, sens = -1, elan = 0, dernierY = scrollY;
addEventListener("scroll", () => {
  const d = scrollY - dernierY; dernierY = scrollY;
  if (d) sens = d > 0 ? -1 : 1;
  elan = Math.min(elan + Math.abs(d) * 0.5, 30);
}, { passive: true });
if (!calme) gsap.ticker.add((t, dt) => {
  const w = piste.firstElementChild.offsetWidth; // two identical halves: wrap after one
  x += sens * (1.2 + elan) * (dt / 16.7);
  elan *= 0.92;
  if (x <= -w) x += w;
  if (x > 0) x -= w;
  piste.style.transform = `translateX(${x}px)`;
});

// --- 04 About: words go from light to dark while reading
if (!calme) {
  const mots = SplitText.create("#texte-apropos", { type: "words" });
  gsap.fromTo(mots.words, { color: "#d3c9be" }, {
    color: "#262626", ease: "none", stagger: 0.1,
    scrollTrigger: { trigger: "#texte-apropos", start: "top 80%", end: "bottom 45%", scrub: true },
  });
}
// side illustrations swell as the pointer gets close
const illus = [...document.querySelectorAll(".js-approche")];
addEventListener("pointermove", (e) => {
  illus.forEach((el) => {
    const r = el.getBoundingClientRect();
    const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    el.style.scale = 1 + 0.25 * Math.max(0, 1 - d / 420);
  });
});
// the toaster pops toasts when clicked
const grille = document.getElementById("grille"), apropos = document.getElementById("apropos");
grille.addEventListener("click", () => {
  if (calme) return;
  const r = grille.getBoundingClientRect(), s = apropos.getBoundingClientRect();
  gsap.fromTo(grille.querySelector(".crop"), { y: 0 }, { y: 10, duration: 0.1, yoyo: true, repeat: 1 });
  [0, 1].forEach((i) => {
    const t = Object.assign(document.createElement("img"), { src: "assets/tartine.png", alt: "", className: "toast-volant" });
    Object.assign(t.style, { left: `${r.left - s.left + r.width * 0.3 + i * 50}px`, top: `${r.top - s.top + r.height * 0.1}px` });
    apropos.appendChild(t);
    gsap.timeline({ onComplete: () => t.remove() })
      .fromTo(t, { scale: 0.4 }, { y: -240 - i * 70, x: i ? 70 : -90, rotation: i ? 420 : -380, scale: 1, duration: 0.6, ease: "power2.out" })
      .to(t, { y: 480, rotation: "+=200", opacity: 0, duration: 0.8, ease: "power2.in" });
  });
});

// --- 06 Projects: cards rise in turn (hover effects are pure CSS)
if (!calme) {
  gsap.set(".projet", { y: 80, opacity: 0 });
  ScrollTrigger.batch(".projet", { start: "top 90%", once: true, onEnter: (els) => gsap.to(els, { y: 0, opacity: 1, stagger: 0.12, duration: 0.8, ease: "power3.out" }) });
}

// --- 07 La carte: the coffee line pours down with the scroll, each dish pops when the coffee reaches it
const traits = [...document.querySelectorAll(".carte__trait")];
const plats = [...document.querySelectorAll(".js-plat")];
const tasse = document.getElementById("tasse");
if (calme) traits.forEach((t) => t.style.setProperty("--coule", "100%"));
else {
  gsap.set(plats, { scale: 0 });
  gsap.to(".carte__moka", { rotation: 6, duration: 1.4, yoyo: true, repeat: -1, ease: "sine.inOut" });
  ScrollTrigger.create({
    trigger: "#carte", start: "top 55%", end: "bottom 75%",
    onUpdate: ({ progress }) => {
      const y = 312 + progress * (2420 - 312); // stage px reached by the coffee
      traits.forEach((t) => t.style.setProperty("--coule", `${clamp(((y - t.offsetTop) / t.offsetHeight) * 100)}%`));
      plats.forEach((el) => {
        const atteint = y > el.offsetTop + 40;
        if (atteint && !el.dataset.servi) {
          el.dataset.servi = "1";
          gsap.to(el, { scale: 1, duration: 0.7, ease: "back.out(2.4)" });
          if (el === tasse) gsap.fromTo(tasse, { rotation: 0 }, { rotation: 360, duration: 1.2, ease: "power2.out" });
        } else if (!atteint && el.dataset.servi) {
          el.dataset.servi = "";
          gsap.to(el, { scale: 0, duration: 0.25 });
        }
      });
    },
  });
}

// --- 08 Testimonials: one quote at a time, arrows or ← → keys
const avis = [...document.querySelectorAll(".avis__item")], num = document.getElementById("avis-num");
let n = 0;
function aller(pas) {
  const ancien = avis[n];
  n = (n + pas + avis.length) % avis.length;
  const nouveau = avis[n];
  num.textContent = n + 1;
  nouveau.classList.add("is-active");
  if (calme) { ancien.classList.remove("is-active"); return; }
  gsap.to(ancien, { x: -70 * pas, opacity: 0, duration: 0.35, onComplete: () => { ancien.classList.remove("is-active"); gsap.set(ancien, { x: 0, opacity: 1 }); } });
  const mots = SplitText.create(nouveau.querySelector("blockquote"), { type: "words" });
  gsap.from(mots.words, { y: 24, opacity: 0, stagger: 0.04, duration: 0.5, delay: 0.25, onComplete: () => mots.revert() });
  gsap.from(nouveau.querySelector("figcaption"), { y: 12, opacity: 0, duration: 0.4, delay: 0.5 });
}
document.querySelectorAll("[data-pas]").forEach((b) => {
  b.addEventListener("click", () => aller(+b.dataset.pas));
  b.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") aller(-1); if (e.key === "ArrowRight") aller(1); });
});

// --- 10 Landing: a fresh toast falls with two flips, the bubble pops and hops; Léa & Maël breathe
if (!calme) {
  gsap.set("#tartine-tombe", { transformPerspective: 900 });
  gsap.set("#bulle", { scale: 0 });
  const chute = gsap.timeline({ paused: true })
    .fromTo("#tartine-tombe", { y: -760, rotationX: 0 }, { y: 0, rotationX: 720, duration: 1.3, ease: "bounce.out" })
    .to("#bulle", { scale: 1, duration: 0.5, ease: "back.out(3)" }, "-=0.35")
    .to("#bulle", { y: -10, duration: 0.18, yoyo: true, repeat: 3 });
  ScrollTrigger.create({ trigger: "#atterrissage", start: "top 55%", onEnter: () => chute.restart(), onLeaveBack: () => chute.pause(0) });
  gsap.to("#lea-mael", { scale: 1.012, y: -5, duration: 2.4, yoyo: true, repeat: -1, ease: "sine.inOut" });
}
