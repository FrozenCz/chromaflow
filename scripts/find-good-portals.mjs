/**
 * Find solvable portal placements where portals are meaningfully far apart.
 * Minimum Manhattan distance of 3 between portal endpoints.
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

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) result.push([arr[i], ...perm]);
  }
  return result;
}

function manhattan(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

function findPortals(name, baseLevel, minDist, maxResults, numPortals) {
  console.log(`\n=== ${name} ===`);
  const epSet = new Set(baseLevel.endpoints.map(e => key(e.position.row, e.position.col)));
  const wallSetLocal = new Set((baseLevel.walls || []).map(w => key(w.row, w.col)));
  const ccSet = new Set((baseLevel.colorChangers || []).map(cc => key(cc.position.row, cc.position.col)));
  const cells = [];
  for (let r = 0; r < baseLevel.height; r++) for (let c = 0; c < baseLevel.width; c++) {
    const k = key(r, c);
    if (!epSet.has(k) && !wallSetLocal.has(k) && !ccSet.has(k)) cells.push({ row: r, col: c });
  }

  let count = 0;

  if (numPortals === 1) {
    for (let i = 0; i < cells.length && count < maxResults; i++) {
      for (let j = i + 1; j < cells.length && count < maxResults; j++) {
        if (manhattan(cells[i], cells[j]) < minDist) continue;
        const level = { ...baseLevel, portals: [{ a: cells[i], b: cells[j] }] };
        const sol = solveLevel(level);
        if (sol) {
          count++;
          console.log(`Portal (${cells[i].row},${cells[i].col})↔(${cells[j].row},${cells[j].col}) [dist=${manhattan(cells[i], cells[j])}]`);
          for (const seg of sol) {
            console.log(`  ${seg.color}: ${seg.path.map(p => `(${p.row},${p.col})`).join('->')}`);
          }
        }
      }
    }
  } else if (numPortals === 2) {
    for (let i = 0; i < cells.length && count < maxResults; i++) {
      for (let j = i + 1; j < cells.length && count < maxResults; j++) {
        if (manhattan(cells[i], cells[j]) < minDist) continue;
        for (let k = j + 1; k < cells.length && count < maxResults; k++) {
          for (let l = k + 1; l < cells.length && count < maxResults; l++) {
            if (manhattan(cells[k], cells[l]) < minDist) continue;
            const level = {
              ...baseLevel,
              portals: [{ a: cells[i], b: cells[j] }, { a: cells[k], b: cells[l] }]
            };
            const sol = solveLevel(level);
            if (sol) {
              count++;
              console.log(`Portals (${cells[i].row},${cells[i].col})↔(${cells[j].row},${cells[j].col}), (${cells[k].row},${cells[k].col})↔(${cells[l].row},${cells[l].col})`);
              for (const seg of sol) {
                console.log(`  ${seg.color}: ${seg.path.map(p => `(${p.row},${p.col})`).join('->')}`);
              }
            }
          }
        }
      }
    }
  }

  if (count === 0) console.log(`No solvable placement found with minDist=${minDist}`);
}

// Level 4: 5x5, R(0,0), R(1,2), B(2,2), B(4,4), 1 portal
findPortals("Level 4", {
  width: 5, height: 5,
  endpoints: [
    { color: "R", position: { row: 0, col: 0 } },
    { color: "R", position: { row: 1, col: 2 } },
    { color: "B", position: { row: 2, col: 2 } },
    { color: "B", position: { row: 4, col: 4 } },
  ],
  walls: [], colorChangers: [],
}, 3, 3, 1);

// Level 5: 6x6, R(0,0), R(2,4), B(1,4), B(5,1), wall(2,3), 1 portal
findPortals("Level 5", {
  width: 6, height: 6,
  endpoints: [
    { color: "R", position: { row: 0, col: 0 } },
    { color: "R", position: { row: 2, col: 4 } },
    { color: "B", position: { row: 1, col: 4 } },
    { color: "B", position: { row: 5, col: 1 } },
  ],
  walls: [{ row: 2, col: 3 }], colorChangers: [],
}, 4, 3, 1);

// Level 9: 6x6, R(0,0), R(0,1), B(0,2), B(0,3), G(0,4), G(5,4), 1 portal, CC B→R at (0,5)
findPortals("Level 9", {
  width: 6, height: 6,
  endpoints: [
    { color: "R", position: { row: 0, col: 0 } },
    { color: "R", position: { row: 0, col: 1 } },
    { color: "B", position: { row: 0, col: 2 } },
    { color: "B", position: { row: 0, col: 3 } },
    { color: "G", position: { row: 0, col: 4 } },
    { color: "G", position: { row: 5, col: 4 } },
  ],
  colorChangers: [{ position: { row: 0, col: 5 }, from: "B", to: "R" }],
  walls: [],
}, 3, 3, 1);

// Level 10: 7x7, R(0,0), R(1,2), B(2,2), B(0,3), G(0,4), G(6,5), 1 portal, wall(3,3), CC G→R at (3,2)
findPortals("Level 10", {
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
}, 4, 3, 1);
