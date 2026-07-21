'use strict';

const particles = [];
const floatTexts = [];

function spawnBurst(x, y, color, count = 16) {
  if (save.reducedMotion) count = Math.min(count, 6);
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 70 + Math.random() * 160;
    particles.push({
      x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 50,
      life: 0.5 + Math.random() * 0.4, max: 0.5 + Math.random() * 0.4,
      r: 2 + Math.random() * 5, color: color || '#80DEEA',
    });
  }
}

function spawnConfetti(x, y, count = 28) {
  if (save.reducedMotion) count = Math.min(count, 10);
  const colors = ['#F48FB1', '#4FC3F7', '#FFD54F', '#CE93D8', '#80CBC4', '#FF8A65', '#FFF'];
  for (let i = 0; i < count; i++) {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
    const sp = 80 + Math.random() * 180;
    particles.push({
      x: x + (Math.random() - 0.5) * 40,
      y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp - 40,
      life: 0.7 + Math.random() * 0.5,
      max: 0.7 + Math.random() * 0.5,
      r: 3 + Math.random() * 5,
      color: colors[i % colors.length],
    });
  }
}

function spawnBubbles(x, y, count = 12) {
  if (save.reducedMotion) count = Math.min(count, 5);
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 60,
      y: y + Math.random() * 40,
      vx: (Math.random() - 0.5) * 20,
      vy: -40 - Math.random() * 80,
      life: 0.8 + Math.random() * 0.6,
      max: 0.8 + Math.random() * 0.6,
      r: 3 + Math.random() * 6,
      color: 'rgba(180, 230, 255, 0.7)',
      bubble: true,
    });
  }
}

function spawnPraise(x, y, text) {
  floatTexts.push({
    x, y, text: text || PRAISE[Math.floor(Math.random() * PRAISE.length)],
    life: 0.95, max: 0.95, vy: -48,
  });
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    if (!p.bubble) p.vy += 180 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
  }
  for (let i = floatTexts.length - 1; i >= 0; i--) {
    const t = floatTexts[i];
    t.life -= dt;
    if (t.life <= 0) { floatTexts.splice(i, 1); continue; }
    t.y += t.vy * dt;
  }
}

function drawParticles(ctx) {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life / p.max) * 0.9;
    if (p.bubble) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  for (const t of floatTexts) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, t.life / t.max);
    ctx.font = 'bold 26px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = '#fff';
    ctx.fillText(t.text, t.x, t.y);
    ctx.restore();
  }
}

function clearParticles() {
  particles.length = 0;
  floatTexts.length = 0;
}
