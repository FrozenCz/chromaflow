/**
 * Find portals for level 6 (dual portals) and level 10
 */

import { readFileSync } from 'fs';

function key(r, c) { return `${r},${c}`; }

function solveLevel(level, timeLimit = 10000) {
  const { width, height, endpoints, portals = [], walls = [], colorChangers = [] } = level;
  const wallSet = new Set(walls.map(w => key(w.row, w.col)));
  const portalMap = new Map();
  for (const p of portals) {
    portalMap.set(key(p.a.row, p.a.col), { row: p.b.row, col: p.b.col });
    portalMap.set(key(p.b.row, p.b.col), { row: p.a.row, col: p.a.col });
  }
  const totalPlayable = width * height - walls.length;
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const colorEndpoints = new Map();
  for (const ep of endpoints) {
    if (!colorEndpoints.has(ep.color)) colorEndpoints.set(ep.color, []);
    colorEndpoints.get(ep.color).push(ep.position);
  }
  const colors = [...colorEndpoints.keys()];
  const endpointAt = new Map();
  for (const ep of endpoints) endpointAt.set(key(ep.position.row, ep.position.col), ep.color);
  const ccMap = new Map();
  for (const cc of colorChangers) ccMap.set(key(cc.position.row, cc.position.col), cc);

  let found = null;
  const startTime = Date.now();

  function getActiveColor(path, baseColor) {
    let color = baseColor;
    for (const pos of path) {
      const cc = ccMap.get(key(pos.row, pos.col));
      if (cc && cc.from === color) color = cc.to;
    }
    return color;
  }

  function tryColors(colorIdx, globalVisited, paths) {
    if (found || Date.now() - startTime > timeLimit) return found !== null;
    if (colorIdx === colors.length) {
      if (globalVisited.size === totalPlayable) {
        found = paths.map(p => ({ color: p.color, path: p.path.map(pos => ({ row: pos.row, col: pos.col })) }));
        return true;
      }
      return false;
    }
    const color = colors[colorIdx];
    const eps = colorEndpoints.get(color);
    for (let si = 0; si < eps.length; si++) {
      const sp = eps[si];
      const sk = key(sp.row, sp.col);
      if (globalVisited.has(sk)) continue;
      globalVisited.add(sk);
      if (solvePath(color, [{ row: sp.row, col: sp.col }], globalVisited, colorIdx, paths)) return true;
      globalVisited.delete(sk);
    }
    return false;
  }

  function solvePath(baseColor, path, visited, colorIdx, completedPaths) {
    if (found || Date.now() - startTime > timeLimit) return found !== null;
    const head = path[path.length - 1];
    const activeColor = getActiveColor(path, baseColor);

    if (path.length >= 2) {
      const startPos = path[0];
      const headEpColor = endpointAt.get(key(head.row, head.col));
      if (headEpColor === activeColor && !(head.row === startPos.row && head.col === startPos.col)) {
        if (tryColors(colorIdx + 1, visited, [...completedPaths, { color: baseColor, path: [...path] }])) return true;
      }
    }

    const partner = portalMap.get(key(head.row, head.col));
    if (partner) {
      const pk = key(partner.row, partner.col);
      const partnerEpColor = endpointAt.get(pk);
      const canTeleport = !visited.has(pk) && !wallSet.has(pk) &&
        (!partnerEpColor || partnerEpColor === activeColor) &&
        !completedPaths.some(p => p.path.some(pos => pos.row === partner.row && pos.col === partner.col));
      if (canTeleport) {
        path.push({ row: partner.row, col: partner.col });
        visited.add(pk);
        if (solvePath(baseColor, path, visited, colorIdx, completedPaths)) return true;
        visited.delete(pk);
        path.pop();
        return false;
      }
    }

    for (const [dr, dc] of directions) {
      const nr = head.row + dr, nc = head.col + dc;
      if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue;
      const nk = key(nr, nc);
      if (visited.has(nk) || wallSet.has(nk)) continue;
      const epColor = endpointAt.get(nk);
      if (epColor && epColor !== activeColor) continue;
      visited.add(nk);
      path.push({ row: nr, col: nc });
      if (solvePath(baseColor, path, visited, colorIdx, completedPaths)) return true;
      path.pop();
      visited.delete(nk);
    }
    return false;
  }

  function perms(arr) {
    if (arr.length <= 1) return [arr];
    const result = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const p of perms(rest)) result.push([arr[i], ...p]);
    }
    return result;
  }

  for (const perm of perms([...Array(colors.length).keys()])) {
    if (found || Date.now() - startTime > timeLimit) break;
    const reordered = perm.map(i => colors[i]);
    const orig = [...colors];
    for (let i = 0; i < colors.length; i++) colors[i] = reordered[i];
    tryColors(0, new Set(), []);
    for (let i = 0; i < orig.length; i++) colors[i] = orig[i];
  }
  return found;
}

function manhattan(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

// Level 6: 6x6, 3 colors, 2 portals
console.log("=== Level 6: 6x6 dual portals ===");
const level6Base = {
  width: 6, height: 6,
  endpoints: [
    { color: "R", position: { row: 0, col: 0 } },
    { color: "R", position: { row: 0, col: 1 } },
    { color: "B", position: { row: 0, col: 2 } },
    { color: "B", position: { row: 0, col: 3 } },
    { color: "G", position: { row: 0, col: 4 } },
    { color: "G", position: { row: 5, col: 4 } },
  ],
  walls: [], colorChangers: [],
};

// Try specific portal placements that are far enough
const candidates6 = [];
const epSet6 = new Set(level6Base.endpoints.map(e => key(e.position.row, e.position.col)));
for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
  if (!epSet6.has(key(r, c))) candidates6.push({ row: r, col: c });
}

let count6 = 0;
// Try some specific combos with portals in different quadrants
const portalPairs = [];
for (let i = 0; i < candidates6.length; i++) {
  for (let j = i + 1; j < candidates6.length; j++) {
    if (manhattan(candidates6[i], candidates6[j]) >= 3) {
      portalPairs.push([candidates6[i], candidates6[j]]);
    }
  }
}

// Try a few combos of two portals
for (let pi = 0; pi < portalPairs.length && count6 < 2; pi++) {
  for (let pj = pi + 1; pj < portalPairs.length && count6 < 2; pj++) {
    const [a1, b1] = portalPairs[pi];
    const [a2, b2] = portalPairs[pj];
    // No overlap
    const cells = [a1, b1, a2, b2];
    const keys = cells.map(c => key(c.row, c.col));
    if (new Set(keys).size !== 4) continue;

    const level = {
      ...level6Base,
      portals: [{ a: a1, b: b1 }, { a: a2, b: b2 }]
    };
    const sol = solveLevel(level, 3000);
    if (sol) {
      count6++;
      console.log(`Portals (${a1.row},${a1.col})↔(${b1.row},${b1.col}), (${a2.row},${a2.col})↔(${b2.row},${b2.col})`);
      for (const seg of sol) {
        console.log(`  ${seg.color}: ${seg.path.map(p => `(${p.row},${p.col})`).join('->')}`);
      }
    }
  }
}
if (count6 === 0) console.log("No dual-portal solution found, trying single portal...");

// Also try single portal for level 6
if (count6 === 0) {
  for (let i = 0; i < candidates6.length && count6 < 2; i++) {
    for (let j = i + 1; j < candidates6.length && count6 < 2; j++) {
      if (manhattan(candidates6[i], candidates6[j]) < 3) continue;
      const level = {
        ...level6Base,
        portals: [{ a: candidates6[i], b: candidates6[j] }]
      };
      const sol = solveLevel(level, 5000);
      if (sol) {
        count6++;
        console.log(`Single portal (${candidates6[i].row},${candidates6[i].col})↔(${candidates6[j].row},${candidates6[j].col})`);
        for (const seg of sol) {
          console.log(`  ${seg.color}: ${seg.path.map(p => `(${p.row},${p.col})`).join('->')}`);
        }
      }
    }
  }
}

// Level 10: 7x7
console.log("\n=== Level 10: 7x7 single portal ===");
const level10Base = {
  width: 7, height: 7,
  endpoints: [
    { color: "R", position: { row: 0, col: 0 } },
    { color: "R", position: { row: 1, col: 2 } },
    { color: "B", position: { row: 2, col: 2 } },
    { color: "B", position: { row: 0, col: 3 } },
    { color: "G", position: { row: 0, col: 4 } },
    { color: "G", position: { row: 6, col: 5 } },
  ],
  walls: [{ row: 3, col: 3 }],
  colorChangers: [{ position: { row: 3, col: 2 }, from: "G", to: "R" }],
};

const epSet10 = new Set(level10Base.endpoints.map(e => key(e.position.row, e.position.col)));
const wallSet10 = new Set(level10Base.walls.map(w => key(w.row, w.col)));
const ccSet10 = new Set(level10Base.colorChangers.map(cc => key(cc.position.row, cc.position.col)));
const candidates10 = [];
for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
  const k = key(r, c);
  if (!epSet10.has(k) && !wallSet10.has(k) && !ccSet10.has(k)) candidates10.push({ row: r, col: c });
}

let count10 = 0;
for (let i = 0; i < candidates10.length && count10 < 2; i++) {
  for (let j = i + 1; j < candidates10.length && count10 < 2; j++) {
    if (manhattan(candidates10[i], candidates10[j]) < 4) continue;
    const level = {
      ...level10Base,
      portals: [{ a: candidates10[i], b: candidates10[j] }]
    };
    const sol = solveLevel(level, 5000);
    if (sol) {
      count10++;
      console.log(`Portal (${candidates10[i].row},${candidates10[i].col})↔(${candidates10[j].row},${candidates10[j].col}) [dist=${manhattan(candidates10[i], candidates10[j])}]`);
      for (const seg of sol) {
        console.log(`  ${seg.color}: ${seg.path.map(p => `(${p.row},${p.col})`).join('->')}`);
      }
    }
  }
}
if (count10 === 0) {
  console.log("No solution with dist>=4, trying dist>=3...");
  for (let i = 0; i < candidates10.length && count10 < 2; i++) {
    for (let j = i + 1; j < candidates10.length && count10 < 2; j++) {
      if (manhattan(candidates10[i], candidates10[j]) < 3) continue;
      const level = {
        ...level10Base,
        portals: [{ a: candidates10[i], b: candidates10[j] }]
      };
      const sol = solveLevel(level, 5000);
      if (sol) {
        count10++;
        console.log(`Portal (${candidates10[i].row},${candidates10[i].col})↔(${candidates10[j].row},${candidates10[j].col}) [dist=${manhattan(candidates10[i], candidates10[j])}]`);
        for (const seg of sol) {
          console.log(`  ${seg.color}: ${seg.path.map(p => `(${p.row},${p.col})`).join('->')}`);
        }
      }
    }
  }
}
