# Mermaid Dress-Up — Roadmap

**For:** ages 4–6 (daughter request)  
**Inspiration:** commercial mermaid dress-up apps (princess cartoon style — big eyes, glossy tails, underwater scenes)  
**Anti-goal:** no canvas “blob shapes” like Dress-Up Dino. Graphics must look **illustrated** and polished.

**Repos:** `dress-up-mermaid` (independent GitHub Pages game)  
**Hub:** catalog entry in `arcade-hub`  
**Live (after deploy):** https://jmitchell238.github.io/dress-up-mermaid/

---

## Product pillars

| Pillar | What it means |
|--------|----------------|
| **Looks great** | Layered PNG illustrations, same style family as commercial mermaid dress-ups |
| **Lots of options** | Many items per category; combinatorial outfits (not 5 total cosmetics) |
| **Kid-safe free play** | Zero fail screens, big touch targets, soft praise, mute + calm motion |
| **Independent + hub** | Own PWA/repo; also launchable from Arcade Hub |

---

## Art strategy (why this works)

Dress-Up Dino draws hats/scarves with canvas paths — that is what looks “terrible” here.  
This game uses **illustrated PNG layers** in commercial princess-mermaid style:

```
draw order (back → front):
  background → look (full mermaid) → jewelry → crown → prop
```

### Why “looks” instead of separate hair/top/tail layers?

AI modular limbs rarely align (floating crowns, mis-matched necks).  
**Full illustrated mermaid “looks”** keep face/pose/polish perfect; accessories stack on top.

- One **style anchor**; every look is an edit-chain recolor/restyle of that character.
- Chroma-key hot-pink backgrounds (`#F040BA` family) with ImageMagick → transparent PNGs.
- Crowns / jewelry / props are trimmed overlays placed at head / neck / hand anchors.

### Categories (catalog)

| Category | v1 ship | Stretch (v1.x) |
|----------|---------|----------------|
| Backgrounds (scenes) | 5 | 10+ |
| Mermaid looks (full character) | 12 | 30+ |
| Crowns / tiaras | 6 | 12+ |
| Jewelry | 6 | 12+ |
| Props | 5 | 10+ |

Rough v1 combinations: **5×12×6×6×5 ≈ 10,800** outfits.  
**Phase 5 option:** true modular hair/top/tail if we invest in a locked rig sheet.

### Future modular expansion (optional)

If we later split hair / top / tail:

```
bg → hair_back → body → tail → top → hair → jewelry → crown → prop
```

Requires a strict pose template and per-piece framing — tracked as art expansion work.

---

## Phased plan

### Phase 0 — Roadmap & tracking ✅
- This document
- Beads epic + tasks (Arcade Hub tracker)

### Phase 1 — Scaffold (session 1)
- Independent repo structure (HTML/CSS/JS PWA, same patterns as other kids games)
- Layer asset loader + compositor
- Menu + play chrome (categories, tray, surprise / save / show-off)
- Config / save / audio / particles / SW / tests shell

### Phase 2 — Art pack v1 (session 1–2)
- Style anchor mermaid
- Base body (3 skin tones)
- First full set of layers (table above “v1 ship”)
- Cover image + app icons
- Chroma-key → transparent pipeline (`scripts/key_layers.sh`)

### Phase 3 — Playable loop (session 1)
- Free Play: equip / unequip / surprise / favorites / show-off dance
- Match Me: ghost target outfit + cheer on match
- Praise bubbles, confetti, soft SFX
- Offline PWA after first visit

### Phase 4 — Ship
- GitHub repo + Pages
- Arcade Hub: cover, `games.json`, `sw.js` asset list, version bump, README library line
- Parent notes (no ads/accounts/fail)

### Phase 5 — Expand (follow-up sessions)
- More hair / tops / tails / jewelry / backgrounds until it feels “endless”
- Optional: second mermaid character, makeup, ear fins, glitter trails
- Optional: photo booth “snapshot” (canvas export) of favorite looks

---

## Technical notes

| Piece | Choice |
|-------|--------|
| Stack | Static HTML / CSS / Canvas (no build) |
| Portrait stage | 390×700 (matches other hub kids games) |
| Layer resolution | 768×1024 source, drawn scaled to stage |
| Persistence | `localStorage` favorites + stats |
| Versioning | `GAME_VERSION` in `js/config.js` ↔ `CACHE` in `sw.js` |

### Layer file convention

```
art/layers/<category>/<id>.png
```

Examples: `art/layers/hair/long-gold.png`, `art/layers/tail/sparkle-teal.png`

Manifest lives in `js/config.js` (`CATEGORIES` + item `src` paths).

---

## Success criteria (daughter test)

1. Opens, looks **pretty** immediately (not abstract shapes).  
2. Can change hair, top, tail, crown, jewelry, background, prop.  
3. Can keep tapping for a long time without running out of fun combos.  
4. Can save a favorite and show it off with sparkles.  
5. Launchable from Arcade Hub on tablet/phone.

---

## Out of scope (for now)

- Multiplayer, accounts, IAP, ads  
- 3D or physics swimming  
- Voice chat / online sharing  
- Exact clones of commercial apps’ proprietary art  

---

## Session handoff

| Done when… | Next… |
|------------|--------|
| Phase 1–3 playable locally | Expand art pack, polish UI tray thumbnails |
| Phase 4 live on Pages | Hub featured optional; more options packs |
