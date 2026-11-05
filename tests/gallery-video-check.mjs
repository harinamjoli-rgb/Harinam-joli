import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const section = read("store.html").match(/<section class="figma-empty-gallery"[\s\S]*?<\/section>/)[0];
assert.match(section, /<video autoplay muted loop playsinline/);
assert.doesNotMatch(section.match(/<video[^>]*>/)[0], /\bcontrols\b/, "The native player bar stays hidden");
assert.match(section, /<button class="gallery-video-button" type="button" aria-label=/);
assert.match(section, /href="products.html\?category=Japa%20Bag"/);
assert.doesNotMatch(section, /<img\b/, "The banner is now a video");
for (const [, src] of section.matchAll(/(?:src|poster)="([^"]+)"/g))
  assert.ok(existsSync(new URL(`../${src}`, import.meta.url)), `Available video or fallback: ${src}`);
const source = read("js/script.js");
const motionSource = source.slice(source.indexOf("const galleryVideo ="), source.indexOf("const promotionTrack ="));
for (const reduced of [false, true]) {
  const video = {
    autoplay: true, paused: false, pauses: 0, handlers: {}, blocked: false,
    addEventListener(name, handler) { this.handlers[name] = handler; },
    pause() { this.pauses++; this.paused = true; this.handlers.pause(); },
    play() {
      if (this.blocked) return Promise.reject(new Error("Playback blocked"));
      this.paused = false; this.handlers.play(); return Promise.resolve();
    },
  };
  const button = { attrs: {}, setAttribute(name, value) { this.attrs[name] = value; }, addEventListener(name, handler) { this.click = handler; } };
  const motion = { matches: reduced, addEventListener(name, handler) { this.change = handler; } };
  runInNewContext(motionSource, { document: { querySelector: selector => selector === ".gallery-video-button" ? button : video }, matchMedia: () => motion });
  assert.equal(video.autoplay, !reduced);
  assert.equal(video.pauses, reduced ? 1 : 0);
  motion.matches = true;
  motion.change();
  assert.equal(video.autoplay, false, "Reduced-motion changes stop automatic playback");
  assert.equal(video.pauses, reduced ? 2 : 1);
  motion.matches = false;
  motion.change();
  assert.equal(video.autoplay, true);
  button.click();
  assert.equal(video.paused, false, "The video surface plays on click or native button keyboard activation");
  assert.equal(button.attrs["aria-label"], "Pause Japa Bags video");
  button.click();
  assert.equal(video.paused, true);
  assert.equal(button.attrs["aria-label"], "Play Japa Bags video");
  video.blocked = true;
  button.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(button.attrs["aria-label"], "Play Japa Bags video", "Blocked playback leaves the accessible action ready to retry");
}
console.log("PASS: video without player bar, accessible play/pause, blocked playback, poster and reduced motion");
