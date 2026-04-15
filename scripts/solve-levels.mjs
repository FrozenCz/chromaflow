/**
 * Level solver for Chromaflow.
 * Uses backtracking to find valid solutions that respect portal teleportation.
 *
 * Portal rule (from game-engine.service.ts):
 * When a path steps onto a portal cell, teleport happens ONLY if:
 * 1. Partner cell is not already in the current path (not visited by this path)
 * 2. Partner cell is not a wall
 * 3. Partner cell is not a foreign-color endpoint
 * 4. Partner cell is not occupied by another color's completed path
 * If teleport happens, partner cell is auto-added to path.
 * If teleport doesn't happen (conditions fail), portal cell acts as regular cell.
 *
 * Usage: node scripts/solve-levels.mjs [world-file] [level-index]
 */

import { readFileSync } from 'fs';

const file = process.argv[2] || 'public/data/levels/world2.json';
const targetLevel = process.argv[3] ? parseInt(process.argv[3], 10) : null;

const data = JSON.parse(readFileSync(file, 'utf8'));

function key(r, c) {
  return `${r},${c}`;
}

function isAdjacent(r1, c1, r2, c2) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

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

  // Group endpoints by color
  const colorEndpoints = new Map();
  for (const ep of endpoints) {
    if (!colorEndpoints.has(ep.color)) colorEndpoints.set(ep.color, []);
    colorEndpoints.get(ep.color).push(ep.position);
  }

  const colors = [...colorEndpoints.keys()];

  // Endpoint lookup
  const endpointAt = new Map();
  for (const ep of endpoints) {
    endpointAt.set(key(ep.position.row, ep.position.col), ep.color);
  }

  // Color changer lookup
  const ccMap = new Map();
  for (const cc of colorChangers) {
    ccMap.set(key(cc.position.row, cc.position.col), cc);
  }

  let bestSolution = null;

  function getActiveColor(path, baseColor) {
    let color = baseColor;
    for (const pos of path) {
      const cc = ccMap.get(key(pos.row, pos.col));
      if (cc && cc.from === color) {
        color = cc.to;
      }
    }
    return color;
  }

  function tryAllColorOrders(colorIdx, globalVisited, paths) {
    if (bestSolution) return true;

    if (colorIdx === colors.length) {
      if (globalVisited.size === totalPlayable) {
        bestSolution = paths.map(p => ({ color: p.color, path: p.path.map(pos => ({ row: pos.row, col: pos.col })) }));
        return true;
      }
      return false;
    }

    const color = colors[colorIdx];
    const eps = colorEndpoints.get(color);

    // Try starting from each endpoint
    for (let startIdx = 0; startIdx < eps.length; startIdx++) {
      const startPos = eps[startIdx];
      const sk = key(startPos.row, startPos.col);
      if (globalVisited.has(sk)) continue;

      const path = [{ row: startPos.row, col: startPos.col }];
      globalVisited.add(sk);

      if (solvePath(color, path, globalVisited, colorIdx, paths)) {
        return true;
      }

      globalVisited.delete(sk);
    }
    return false;
  }

  function solvePath(baseColor, path, visited, colorIdx, completedPaths) {
    if (bestSolution) return true;

    const head = path[path.length - 1];
    const activeColor = getActiveColor(path, baseColor);

    // Check if we've reached an endpoint that completes this path
    if (path.length >= 2) {
      const startPos = path[0];
      const headKey = key(head.row, head.col);
      const headEpColor = endpointAt.get(headKey);

      if (headEpColor === activeColor &&
          !(head.row === startPos.row && head.col === startPos.col)) {
        // Path is complete - try next color
        const newPaths = [...completedPaths, { color: baseColor, path: [...path] }];
        if (tryAllColorOrders(colorIdx + 1, visited, newPaths)) {
          return true;
        }
        // Allow continuing past endpoint (not mandatory stop) — actually
        // if we reached the destination endpoint we should stop, endpoints
        // are terminals. But let's allow the solver to continue in case
        // the endpoint needs to be visited but not terminated at this point.
        // Actually no — the game requires paths to terminate at endpoints.
        // But we don't return false here because the solver might need to
        // explore other options.
      }
    }

    // Check if head is on a portal cell - determine if teleport happens
    const partner = portalMap.get(key(head.row, head.col));
    if (partner) {
      const pk = key(partner.row, partner.col);
      const partnerEpColor = endpointAt.get(pk);

      // Teleport happens if: partner not visited, not wall, not foreign endpoint, not occupied by other path
      const partnerUnvisited = !visited.has(pk);
      const partnerNotWall = !wallSet.has(pk);
      const partnerNotForeign = !partnerEpColor || partnerEpColor === activeColor;
      const partnerNotOccupied = !completedPaths.some(p =>
        p.path.some(pos => pos.row === partner.row && pos.col === partner.col)
      );

      if (partnerUnvisited && partnerNotWall && partnerNotForeign && partnerNotOccupied) {
        // Teleport is FORCED - partner auto-added
        path.push({ row: partner.row, col: partner.col });
        visited.add(pk);

        if (solvePath(baseColor, path, visited, colorIdx, completedPaths)) {
          return true;
        }

        visited.delete(pk);
        path.pop();
        return false; // Can't do anything else from portal if teleport conditions are met but path fails
      }
      // If teleport conditions not met, portal cell acts as regular cell - fall through
    }

    // Try all adjacent cells
    for (const [dr, dc] of directions) {
      const nr = head.row + dr;
      const nc = head.col + dc;
      if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue;
      const nk = key(nr, nc);
      if (visited.has(nk)) continue;
      if (wallSet.has(nk)) continue;

      // Can't enter endpoint of another color
      const epColor = endpointAt.get(nk);
      if (epColor && epColor !== activeColor) continue;

      visited.add(nk);
      path.push({ row: nr, col: nc });

      if (solvePath(baseColor, path, visited, colorIdx, completedPaths)) {
        return true;
      }

      path.pop();
      visited.delete(nk);
    }

    return false;
  }

  // Try different color orderings
  function permutations(arr) {
    if (arr.length <= 1) return [arr];
    const result = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const perm of permutations(rest)) {
        result.push([arr[i], ...perm]);
      }
    }
    return result;
  }

  // Try all color orderings for better chances
  const colorPerms = permutations([...Array(colors.length).keys()]);
  for (const perm of colorPerms) {
    if (bestSolution) break;
    const reorderedColors = perm.map(i => colors[i]);
    // Temporarily reorder
    const origColors = [...colors];
    for (let i = 0; i < colors.length; i++) colors[i] = reorderedColors[i];

    tryAllColorOrders(0, new Set(), []);

    for (let i = 0; i < origColors.length; i++) colors[i] = origColors[i];
  }

  return bestSolution;
}

// Process levels
for (let i = 0; i < data.levels.length; i++) {
  const levelNum = i + 1;
  if (targetLevel !== null && levelNum !== targetLevel) continue;

  const level = data.levels[i];
  const hasPortals = level.portals && level.portals.length > 0;

  if (targetLevel === null && !hasPortals) {
    console.log(`Level ${levelNum} (${level.id}): No portals, skipping solver`);
    continue;
  }

  console.log(`\nSolving Level ${levelNum} (${level.id}): ${level.name} [${level.width}x${level.height}]`);
  if (hasPortals) {
    console.log(`  Portals: ${level.portals.map(p => `(${p.a.row},${p.a.col})↔(${p.b.row},${p.b.col})`).join(', ')}`);
  }

  const startTime = Date.now();
  const solution = solveLevel(level);
  const elapsed = Date.now() - startTime;

  if (solution) {
    console.log(`  SOLVED in ${elapsed}ms!`);
    for (const seg of solution) {
      const pathStr = seg.path.map(p => `(${p.row},${p.col})`).join('->');
      console.log(`    ${seg.color}: ${pathStr}`);
    }
  } else {
    console.log(`  NO SOLUTION FOUND (${elapsed}ms)`);
    console.log(`  Level may need redesign (portal placement makes 100% fill impossible)`);
  }
}
