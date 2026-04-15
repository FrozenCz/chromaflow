/**
 * Tries different portal placements for levels to find solvable configurations.
 * Usage: node scripts/find-portal-placement.mjs
 */

import { readFileSync } from 'fs';

function key(r, c) { return `${r},${c}`; }

function solveLevel(level) {
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

  function getActiveColor(path, baseColor) {
    let color = baseColor;
    for (const pos of path) {
      const cc = ccMap.get(key(pos.row, pos.col));
      if (cc && cc.from === color) color = cc.to;
    }
    return color;
  }

  function tryColors(colorIdx, globalVisited, paths) {
    if (found) return true;
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
    if (found) return true;
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

  // Try multiple color orderings
  function permutations(arr) {
    if (arr.length <= 1) return [arr];
    const result = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const perm of permutations(rest)) result.push([arr[i], ...perm]);
    }
    return result;
  }

  for (const perm of permutations([...Array(colors.length).keys()])) {
    if (found) break;
    const reordered = perm.map(i => colors[i]);
    const orig = [...colors];
    for (let i = 0; i < colors.length; i++) colors[i] = reordered[i];
    tryColors(0, new Set(), []);
    for (let i = 0; i < orig.length; i++) colors[i] = orig[i];
  }

  return found;
}

// Level 4: 5x5, R(0,0), R(1,2), B(2,2), B(4,4)
// Try all possible portal placements
console.log("=== Level 4: Finding portal placements ===");
const level4Base = {
  width: 5, height: 5,
  endpoints: [
    { color: "R", position: { row: 0, col: 0 } },
    { color: "R", position: { row: 1, col: 2 } },
    { color: "B", position: { row: 2, col: 2 } },
    { color: "B", position: { row: 4, col: 4 } },
  ],
  colorChangers: [],
  walls: [],
};

const epSet4 = new Set(level4Base.endpoints.map(e => key(e.position.row, e.position.col)));
const cells4 = [];
for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
  if (!epSet4.has(key(r, c))) cells4.push({ row: r, col: c });
}

let found4 = 0;
for (let i = 0; i < cells4.length && found4 < 3; i++) {
  for (let j = i + 1; j < cells4.length && found4 < 3; j++) {
    const a = cells4[i], b = cells4[j];
    const level = {
      ...level4Base,
      portals: [{ a, b }],
    };
    const sol = solveLevel(level);
    if (sol) {
      found4++;
      console.log(`Portal (${a.row},${a.col})↔(${b.row},${b.col}) => SOLVABLE`);
      for (const seg of sol) {
        console.log(`  ${seg.color}: ${seg.path.map(p => `(${p.row},${p.col})`).join('->')}`);
      }
    }
  }
}
if (found4 === 0) console.log("No solvable portal placement found for level 4 base layout");

// Level 5: 6x6, R(0,0), R(2,4), B(1,4), B(5,1), wall(2,3)
console.log("\n=== Level 5: Finding portal placements ===");
const level5Base = {
  width: 6, height: 6,
  endpoints: [
    { color: "R", position: { row: 0, col: 0 } },
    { color: "R", position: { row: 2, col: 4 } },
    { color: "B", position: { row: 1, col: 4 } },
    { color: "B", position: { row: 5, col: 1 } },
  ],
  walls: [{ row: 2, col: 3 }],
  colorChangers: [],
};

const epSet5 = new Set(level5Base.endpoints.map(e => key(e.position.row, e.position.col)));
const wallSet5 = new Set(level5Base.walls.map(w => key(w.row, w.col)));
const cells5 = [];
for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
  const k = key(r, c);
  if (!epSet5.has(k) && !wallSet5.has(k)) cells5.push({ row: r, col: c });
}

let found5 = 0;
for (let i = 0; i < cells5.length && found5 < 3; i++) {
  for (let j = i + 1; j < cells5.length && found5 < 3; j++) {
    const a = cells5[i], b = cells5[j];
    const level = {
      ...level5Base,
      portals: [{ a, b }],
    };
    const sol = solveLevel(level);
    if (sol) {
      found5++;
      console.log(`Portal (${a.row},${a.col})↔(${b.row},${b.col}) => SOLVABLE`);
      for (const seg of sol) {
        console.log(`  ${seg.color}: ${seg.path.map(p => `(${p.row},${p.col})`).join('->')}`);
      }
    }
  }
}
if (found5 === 0) console.log("No solvable portal placement found for level 5 base layout");
