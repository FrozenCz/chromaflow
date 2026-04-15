/**
 * Validates all level files in public/data/levels/*.json.
 *
 * For each level it checks:
 * 1. Solution paths are valid (each step is 4-adjacent OR portal jump)
 * 2. Portal teleportation is correctly applied (portal cell followed by partner)
 * 3. 100% coverage of playable cells (total - walls)
 * 4. No path passes through walls
 * 5. Paths start and end on correct endpoints
 * 6. No cell visited by multiple paths
 *
 * Usage: node scripts/validate-levels.mjs
 */

import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

const LEVELS_DIR = 'public/data/levels';

function key(r, c) {
  return `${r},${c}`;
}

function validateLevel(level, worldId) {
  const { id, name, width, height, endpoints, solution, portals = [], walls = [], colorChangers = [] } = level;
  const errors = [];
  const warnings = [];

  if (!solution || solution.length === 0) {
    errors.push('No solution defined');
    return { id, name, worldId, errors, warnings };
  }

  const wallSet = new Set(walls.map(w => key(w.row, w.col)));
  const totalPlayable = width * height - walls.length;

  // Build portal map
  const portalMap = new Map();
  for (const p of portals) {
    portalMap.set(key(p.a.row, p.a.col), { row: p.b.row, col: p.b.col });
    portalMap.set(key(p.b.row, p.b.col), { row: p.a.row, col: p.a.col });
  }

  // Build endpoint map
  const endpointAt = new Map();
  for (const ep of endpoints) {
    endpointAt.set(key(ep.position.row, ep.position.col), ep.color);
  }

  // Build color changer map
  const ccMap = new Map();
  for (const cc of colorChangers) {
    ccMap.set(key(cc.position.row, cc.position.col), cc);
  }

  const allVisited = new Set();

  for (const seg of solution) {
    const { color, path } = seg;

    if (!path || path.length === 0) {
      errors.push(`${color}: Empty path`);
      continue;
    }

    // Check start endpoint
    const start = path[0];
    const startEpColor = endpointAt.get(key(start.row, start.col));
    if (startEpColor !== color) {
      errors.push(`${color}: Start (${start.row},${start.col}) is not a ${color} endpoint`);
    }

    // Check end endpoint — track active color through color changers
    let activeColor = color;
    for (const pos of path) {
      const cc = ccMap.get(key(pos.row, pos.col));
      if (cc && cc.from === activeColor) {
        activeColor = cc.to;
      }
    }
    const end = path[path.length - 1];
    const endEpColor = endpointAt.get(key(end.row, end.col));
    if (endEpColor !== activeColor) {
      errors.push(`${color}: End (${end.row},${end.col}) is not a ${activeColor} endpoint (active color after changers)`);
    }

    // Check start != end position
    if (start.row === end.row && start.col === end.col) {
      errors.push(`${color}: Start and end are the same cell`);
    }

    // Track visited cells for this path to check portal teleport correctly
    const pathVisited = new Set();

    for (let i = 0; i < path.length; i++) {
      const pos = path[i];
      const k = key(pos.row, pos.col);

      // Bounds check
      if (pos.row < 0 || pos.row >= height || pos.col < 0 || pos.col >= width) {
        errors.push(`${color} step ${i}: (${pos.row},${pos.col}) out of bounds`);
        continue;
      }

      // Wall check
      if (wallSet.has(k)) {
        errors.push(`${color} step ${i}: (${pos.row},${pos.col}) is a wall`);
      }

      // Duplicate check across ALL paths
      if (allVisited.has(k)) {
        errors.push(`${color} step ${i}: (${pos.row},${pos.col}) already visited by another path`);
      }

      // Duplicate check within THIS path
      if (pathVisited.has(k)) {
        errors.push(`${color} step ${i}: (${pos.row},${pos.col}) visited twice in same path`);
      }

      allVisited.add(k);
      pathVisited.add(k);

      // Adjacency / portal check
      if (i > 0) {
        const prev = path[i - 1];
        const dist = Math.abs(prev.row - pos.row) + Math.abs(prev.col - pos.col);
        const isAdj = dist === 1;

        // Check if this is a portal jump
        const partner = portalMap.get(key(prev.row, prev.col));
        const isPortalJump = partner && partner.row === pos.row && partner.col === pos.col;

        if (!isAdj && !isPortalJump) {
          errors.push(
            `${color} step ${i}: (${prev.row},${prev.col})->(${pos.row},${pos.col}) ` +
            `is neither adjacent (dist=${dist}) nor portal jump`
          );
        }

        // Check FORCED portal teleportation
        // If prev is a portal cell AND partner is unvisited at this point, teleport should happen
        if (isAdj && partner) {
          const pk = key(partner.row, partner.col);
          // Check if partner was already visited BEFORE this step
          const partnerAlreadyVisited = allVisited.has(pk) && !pathVisited.has(pk) ||
            // Partner in current path before this step
            (pathVisited.has(pk) && !(pos.row === partner.row && pos.col === partner.col));

          // Simpler check: if we moved adjacently from a portal cell, and the next cell
          // is NOT the partner, that's only valid if partner was already visited
          if (pos.row !== partner.row || pos.col !== partner.col) {
            // We did NOT teleport. Was partner already visited?
            const partnerVisitedBefore = pathVisited.has(pk) ||
              // Check if another completed path already covers the partner
              allVisited.has(pk);

            if (!partnerVisitedBefore && !wallSet.has(pk)) {
              // Check if partner is a foreign-color endpoint
              const partnerEpColor = endpointAt.get(pk);
              // Compute active color at this point in the path
              let currentActiveColor = color;
              for (let j = 0; j <= i - 1; j++) {
                const cc = ccMap.get(key(path[j].row, path[j].col));
                if (cc && cc.from === currentActiveColor) currentActiveColor = cc.to;
              }

              const isForeignEndpoint = partnerEpColor && partnerEpColor !== currentActiveColor;

              if (!isForeignEndpoint) {
                errors.push(
                  `${color} step ${i}: Portal at (${prev.row},${prev.col}) should teleport to ` +
                  `(${partner.row},${partner.col}) but path goes to (${pos.row},${pos.col}). ` +
                  `Partner is unvisited and teleport should be forced.`
                );
              }
            }
          }
        }
      }
    }
  }

  // Coverage check
  if (allVisited.size !== totalPlayable) {
    errors.push(`Coverage: ${allVisited.size}/${totalPlayable} playable cells covered`);

    // Find uncovered cells
    const uncovered = [];
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const k = key(r, c);
        if (!wallSet.has(k) && !allVisited.has(k)) {
          uncovered.push(`(${r},${c})`);
        }
      }
    }
    if (uncovered.length <= 10) {
      errors.push(`Uncovered cells: ${uncovered.join(', ')}`);
    }
  }

  return { id, name, worldId, errors, warnings };
}

// Process all level files
const files = readdirSync(LEVELS_DIR).filter(f => f.endsWith('.json')).sort();
let totalLevels = 0;
let passedLevels = 0;
let failedLevels = 0;

for (const file of files) {
  const filePath = join(LEVELS_DIR, file);
  const data = JSON.parse(readFileSync(filePath, 'utf8'));
  const worldId = data.metadata?.id || basename(file, '.json');

  console.log(`\n=== ${data.metadata?.name || file} (${file}) ===`);

  for (let i = 0; i < data.levels.length; i++) {
    const level = data.levels[i];
    totalLevels++;

    const result = validateLevel(level, worldId);

    if (result.errors.length === 0) {
      passedLevels++;
      const hasPortals = (level.portals || []).length > 0;
      const hasCc = (level.colorChangers || []).length > 0;
      const features = [
        hasPortals ? 'portals' : null,
        hasCc ? 'color-changers' : null,
        (level.walls || []).length > 0 ? 'walls' : null,
      ].filter(Boolean).join(', ');
      console.log(`  Level ${i + 1} (${result.id}): OK${features ? ` [${features}]` : ''}`);
    } else {
      failedLevels++;
      console.log(`  Level ${i + 1} (${result.id}): FAIL`);
      for (const err of result.errors) {
        console.log(`    ERROR: ${err}`);
      }
    }

    for (const warn of result.warnings) {
      console.log(`    WARN: ${warn}`);
    }
  }
}

console.log(`\n=== Summary ===`);
console.log(`Total: ${totalLevels} levels`);
console.log(`Passed: ${passedLevels}`);
console.log(`Failed: ${failedLevels}`);

process.exit(failedLevels > 0 ? 1 : 0);
