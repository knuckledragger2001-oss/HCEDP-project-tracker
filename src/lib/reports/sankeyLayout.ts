import type { SankeyPayload } from "./dashboard";

// Geometry for drawing a Sankey by hand. Recharts lays out the on-screen chart
// itself; this exists for the PDF, where pdfmake can draw filled polygons but
// has no chart engine. Kept separate from pdf.ts so the maths is testable and
// so a future SVG renderer can reuse it.
//
// The payload has exactly one node per pipeline stage, so each node gets its own
// column. Columns are equal width, which lets the caller lay the stage labels
// out as a plain equal-width columns row instead of positioning text absolutely.

export interface SankeyNodeBox {
  name: string;
  /** Projects flowing through this node — max of its inflow and outflow. */
  value: number;
  centerX: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SankeyRibbon {
  value: number;
  /** Closed polygon, already smoothed. Draw with a single fill. */
  points: { x: number; y: number }[];
}

export interface SankeyGeometry {
  nodes: SankeyNodeBox[];
  ribbons: SankeyRibbon[];
  columnWidth: number;
}

export interface SankeyLayoutOptions {
  width: number;
  height: number;
  nodeWidth?: number;
  /** Samples per ribbon edge. More is smoother and larger in the PDF. */
  curveSteps?: number;
}

// Cosine ease, giving each ribbon the flat-then-steep-then-flat shape a Sankey
// is expected to have. A straight line would read as a bar chart with legs.
function ease(t: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * t);
}

export function layoutSankey(
  payload: SankeyPayload,
  { width, height, nodeWidth = 8, curveSteps = 20 }: SankeyLayoutOptions,
): SankeyGeometry {
  const { nodes, links } = payload;
  const count = nodes.length;
  if (count === 0) return { nodes: [], ribbons: [], columnWidth: 0 };

  const columnWidth = width / count;

  const inflow = nodes.map((_, i) =>
    links.filter((l) => l.target === i).reduce((s, l) => s + l.value, 0),
  );
  const outflow = nodes.map((_, i) =>
    links.filter((l) => l.source === i).reduce((s, l) => s + l.value, 0),
  );
  const values = nodes.map((_, i) => Math.max(inflow[i], outflow[i]));
  const peak = Math.max(...values, 1);

  // Scale the busiest node to fill the height; every other node is proportional.
  const scale = height / peak;

  const boxes: SankeyNodeBox[] = nodes.map((n, i) => {
    const h = values[i] * scale;
    const centerX = columnWidth * (i + 0.5);
    return {
      name: n.name,
      value: values[i],
      centerX,
      x: centerX - nodeWidth / 2,
      y: (height - h) / 2,
      width: nodeWidth,
      height: h,
    };
  });

  // Stack each node's outgoing ribbons top-to-bottom by target, and each node's
  // incoming ribbons top-to-bottom by source, so ribbons don't cross needlessly.
  const outCursor = boxes.map((b) => b.y);
  const inCursor = boxes.map((b) => b.y);

  const bySource = [...links].sort(
    (a, b) => a.source - b.source || a.target - b.target,
  );
  const byTarget = [...links].sort(
    (a, b) => a.target - b.target || a.source - b.source,
  );

  const startY = new Map<string, number>();
  for (const l of bySource) {
    startY.set(`${l.source}>${l.target}`, outCursor[l.source]);
    outCursor[l.source] += l.value * scale;
  }
  const endY = new Map<string, number>();
  for (const l of byTarget) {
    endY.set(`${l.source}>${l.target}`, inCursor[l.target]);
    inCursor[l.target] += l.value * scale;
  }

  const ribbons: SankeyRibbon[] = bySource.map((l) => {
    const key = `${l.source}>${l.target}`;
    const thickness = l.value * scale;
    const x0 = boxes[l.source].x + boxes[l.source].width;
    const x1 = boxes[l.target].x;
    const y0 = startY.get(key)!;
    const y1 = endY.get(key)!;

    const top: { x: number; y: number }[] = [];
    const bottom: { x: number; y: number }[] = [];
    for (let s = 0; s <= curveSteps; s++) {
      const t = s / curveSteps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * ease(t);
      top.push({ x, y });
      bottom.push({ x, y: y + thickness });
    }
    return { value: l.value, points: [...top, ...bottom.reverse()] };
  });

  return { nodes: boxes, ribbons, columnWidth };
}
