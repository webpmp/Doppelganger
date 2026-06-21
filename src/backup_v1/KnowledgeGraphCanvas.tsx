import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { ActiveNode, Edge } from "../types";

interface KnowledgeGraphCanvasProps {
  nodes: ActiveNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  unlockedTokens?: string[];
  onSelectNode: (nodeId: string | null) => void;
  activeViewId: string;
  nodePositions: { [nodeId: string]: { x: number; y: number } } | null;
  onStartDragging: (positions: { [nodeId: string]: { x: number; y: number } }) => void;
  onNodeDragged: (positions: { [nodeId: string]: { x: number; y: number } }) => void;
  activeDoppelgangerId: string;
  resetTrigger?: number;
}

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  summary: string;
  weight: number;
  visibility_status: string;
  access_key_hash?: string | null;
  accessKeyHash?: string | null;
  _children?: D3Node[];
  isShared?: boolean;
  ownerName?: string;
  ownerTitle?: string;
  relationshipSummary?: string;
  doppelgangerId?: string;
  ownerId?: string;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string | D3Node;
  target: string | D3Node;
  relation?: string;
}

// Fixed color array mapping unique hex codes to each project family (Indigo for 1.0, Coral/Orange for 2.0, Emerald for 3.0, Amber for 4.0)
const PROJECT_COLORS: Record<string, string> = {
  "1": "#6366F1", // Indigo
  "2": "#F97316", // Coral
  "3": "#10B981", // Emerald
  "4": "#F59E0B", // Amber
};

function getFamilyNumber(idOrLabel: string): string {
  const match = idOrLabel.match(/(?:node-|Project |^)(\d+)\./i);
  if (match && match[1]) {
    return match[1];
  }
  const labelMatch = idOrLabel.match(/(\d+)\./);
  if (labelMatch && labelMatch[1]) {
    return labelMatch[1];
  }
  return "default";
}

function getProjectColor(idOrLabel: string): string {
  const family = getFamilyNumber(idOrLabel);
  return PROJECT_COLORS[family] || "#8B5CF6"; // Fallback to violet-500, avoiding gray for local nodes
}

function getProjectColorTint(idOrLabel: string, opacity: number): string {
  const color = getProjectColor(idOrLabel);
  if (color.startsWith("#")) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return color;
}

function getGlobalNodeColors(d: any, activeDoppelgangerId?: string): { fill: string; stroke: string; family: 'cyan' | 'red' | 'emerald' | 'amber' | 'violet' } {
  // Step 1: Determine node ownership
  const isLocalNode = activeDoppelgangerId && d?.doppelgangerId 
    ? (d.doppelgangerId === activeDoppelgangerId)
    : !d?.isShared;

  // Step 3: IF external/shared node: SKIP ALL COLOR PIPELINES and forceSharedNodeStyle
  if (!isLocalNode) {
    // Apply SHARED_GRAY override
    const SHARED_GRAY = "#52525b"; // zinc-650
    const fillStyle = "#1f1f23";
    
    return {
      fill: fillStyle,
      stroke: SHARED_GRAY,
      family: "violet" // dummy fallback to respect return type signature
    };
  }

  // Debug Validation (Step 10)
  if (activeDoppelgangerId && d?.ownerId && d.ownerId !== activeDoppelgangerId) {
    const SHARED_GRAY = "#52525b";
    if (d.color !== SHARED_GRAY) {
      console.error("External node color violation");
    }
  }

  // Step 2: IF local node: apply normal graph color logic.
  const idStr = d?.id || "";
  const weight = d?.weight;

  let family: 'cyan' | 'red' | 'emerald' | 'amber' | 'violet' = 'violet';
  if (idStr.includes("1.")) family = 'cyan';
  else if (idStr.includes("2.")) family = 'red';
  else if (idStr.includes("3.")) family = 'emerald';
  else if (idStr.includes("4.")) family = 'amber';

  const schemes = {
    cyan: {
      parent: { fill: '#155e75', stroke: '#22d3ee' },
      child: { fill: '#0e4152', stroke: '#0ea5e9' },
      grandchild: { fill: '#082733', stroke: '#0284c7' }
    },
    red: {
      parent: { fill: '#881337', stroke: '#f43f5e' },
      child: { fill: '#5c0d25', stroke: '#db2777' },
      grandchild: { fill: '#3d0919', stroke: '#be123c' }
    },
    emerald: {
      parent: { fill: '#064e3b', stroke: '#34d399' },
      child: { fill: '#043528', stroke: '#10b981' },
      grandchild: { fill: '#02241b', stroke: '#059669' }
    },
    amber: {
      parent: { fill: '#78350f', stroke: '#fbbf24' },
      child: { fill: '#5c2c0a', stroke: '#f59e0b' },
      grandchild: { fill: '#3b1c06', stroke: '#d97706' }
    },
    violet: {
      parent: { fill: '#2e1065', stroke: '#a78bfa' }, // violet parents
      child: { fill: '#1e1b4b', stroke: '#818cf8' }, // violet children
      grandchild: { fill: '#0f172a', stroke: '#6366f1' } // violet grandchildren
    }
  };

  const currentFamily = schemes[family];
  if (weight === 3.0) return { ...currentFamily.parent, family };
  if (weight === 2.0) return { ...currentFamily.child, family };
  return { ...currentFamily.grandchild, family };
}

function getGlobalLinkColor(link: any, activeDoppelgangerId?: string): string {
  const sourceId = typeof link.source === "object" ? link.source.id : link.source;
  const targetId = typeof link.target === "object" ? link.target.id : link.target;
  const idStr = sourceId || targetId || "";
  
  const sourceIsShared = typeof link.source === "object" 
    ? (link.source.doppelgangerId !== activeDoppelgangerId)
    : (sourceId?.startsWith("shared-"));
  const targetIsShared = typeof link.target === "object"
    ? (link.target.doppelgangerId !== activeDoppelgangerId)
    : (targetId?.startsWith("shared-"));

  // Checking if either node is shared – if so, draw faint gray link
  if (sourceIsShared || targetIsShared) {
    return "#3f3f46"; // faint gray link exclusively for shared nodes
  }

  if (idStr.includes("1.")) return "#155e75";
  if (idStr.includes("2.")) return "#881337";
  if (idStr.includes("3.")) return "#064e3b";
  if (idStr.includes("4.")) return "#78350f";
  return "#2e1065"; // non-gray fallback, deep violet line
}

function isNodeLocked(
  d: any,
  unlockedTokens: string[],
  parentOfNode?: Map<string, string>,
  nodes?: ActiveNode[]
): boolean {
  if (d.visibility_status === "isolated_passphrase") {
    const key = (d.access_key_hash || d.accessKeyHash || "").toUpperCase().trim();
    if (key && !unlockedTokens.includes(key)) {
      return true;
    }
  }
  if (parentOfNode && nodes) {
    const parentId = parentOfNode.get(d.id);
    if (parentId) {
      const parentNode = nodes.find(n => n.id === parentId);
      if (parentNode && parentNode.visibility_status === "isolated_passphrase") {
        const key = (parentNode.access_key_hash || parentNode.accessKeyHash || "").toUpperCase().trim();
        if (key && !unlockedTokens.includes(key)) {
          return true;
        }
      }
    }
  }
  return false;
}

export default function KnowledgeGraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  unlockedTokens = [],
  onSelectNode,
  activeViewId,
  nodePositions,
  onStartDragging,
  onNodeDragged,
  activeDoppelgangerId,
  resetTrigger,
}: KnowledgeGraphCanvasProps) {
  const getNodeColors = (d: any) => getGlobalNodeColors(d, activeDoppelgangerId);
  const getLinkColor = (link: any) => getGlobalLinkColor(link, activeDoppelgangerId);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });

  // Stateful tracking of the currently expanded parent (only one expanded at a time to collapse competitors)
  const [expandedParentId, setExpandedParentId] = useState<string | null>(null);

  // Stateful tracking of visual legend hover panel expansion
  const [isLegendExpanded, setIsLegendExpanded] = useState(false);

  // Derive counts for legend display
  const isLocalNodeVal = (n: any) => activeDoppelgangerId && n?.doppelgangerId 
    ? (n.doppelgangerId === activeDoppelgangerId)
    : !n?.isShared;
  const relatedCount = nodes.filter(n => !isLocalNodeVal(n)).length;
  const privateCount = nodes.filter(n => isLocalNodeVal(n) && n.visibility_status === "isolated_passphrase").length;

  // Refs to maintain d3 layout and coordinate persistence across selection changes
  const d3NodesRef = useRef<D3Node[]>([]);
  const prevSelectedNodeIdRef = useRef<string | null>(null);
  const hasInitialFitRef = useRef<boolean>(false);
  const prevNodesCountRef = useRef<number>(0);

  // Map and group children & grandchildren under parent nodes
  const parentGroups = useMemo(() => {
    const parentOfNode = new Map<string, string>(); // child ID -> parent ID
    const parentMap = new Map<string, ActiveNode[]>(); // parent ID -> child ActiveNodes

    const parentNodes = nodes.filter(n => n.weight === 3.0);
    parentNodes.forEach(p => parentMap.set(p.id, []));

    // Build adjacency list for undirected search
    const adj = new Map<string, string[]>();
    nodes.forEach(n => adj.set(n.id, []));
    edges.forEach(e => {
      if (adj.has(e.source) && adj.has(e.target)) {
        // EXCLUDE shared/gray nodes from local hierarchical BFS traversal
        const sourceNode = nodes.find(n => n.id === e.source);
        const targetNode = nodes.find(n => n.id === e.target);
        const sourceIsShared = sourceNode && (sourceNode as any).isShared === true;
        const targetIsShared = targetNode && (targetNode as any).isShared === true;

        if (!sourceIsShared && !targetIsShared) {
          adj.get(e.source)!.push(e.target);
          adj.get(e.target)!.push(e.source);
        }
      }
    });

    // BFS to gather all Tier 2 & Tier 3 descendants connected directly or indirectly
    parentNodes.forEach(p => {
      const queue: string[] = [p.id];
      const visited = new Set<string>([p.id]);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        const neighbors = adj.get(curr) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            const neighborNode = nodes.find(n => n.id === neighbor);
            if (neighborNode && neighborNode.weight < 3.0) {
              visited.add(neighbor);
              queue.push(neighbor);
              parentMap.get(p.id)!.push(neighborNode);
              parentOfNode.set(neighbor, p.id);
            }
          }
        }
      }
    });

    // Map parentOfNode explicitly for shared nodes to support parent attraction forces and locking
    nodes.forEach(n => {
      if ((n as any).isShared && (n as any).parentId) {
        parentOfNode.set(n.id, (n as any).parentId);
      }
    });

    return { parentMap, parentOfNode };
  }, [nodes, edges]);

  // Calculate a Parent's size based on its downstream activity volume
  const getParentRadius = (d: any) => {
    if (d.weight !== 3.0) return d.weight === 2.0 ? 16 : 8; // Static radius for Child and Grandchild nodes
    
    // Count how many total child and grandchild nodes link back to this specific parent ID
    const fromGroup = parentGroups.parentMap.get(d.id)?.length || 0;
    const parts = d.id.split('-');
    const baseId = parts[1] || d.id;
    const fromIdMatch = nodes.filter(n => n.id.startsWith(baseId) && n.id !== d.id).length;
    const associatedNodesCount = Math.max(fromGroup, fromIdMatch);
    
    const baseRadius = 24;
    const growthFactor = 4;
    return baseRadius + (associatedNodesCount * growthFactor);
  };

  // Handle ResizeObserver responsive sizing
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({
        width: Math.max(width, 300),
        height: Math.max(height, 300),
      });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Synchronously auto-expand parent when a child node is selected externally
  useEffect(() => {
    if (selectedNodeId) {
      const nodeObj = nodes.find(n => n.id === selectedNodeId);
      if (nodeObj && nodeObj.weight < 3.0) {
        const parentId = parentGroups.parentOfNode.get(selectedNodeId);
        if (parentId && parentId !== expandedParentId) {
          setExpandedParentId(parentId);
        }
      }
    }
  }, [selectedNodeId, parentGroups, expandedParentId, nodes]);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const { width, height } = dimensions;

    // Map existing nodes matching indices/IDs of existing nodes to guarantee coordinate continuity
    const prevNodesMap = new Map<string, D3Node>(d3NodesRef.current.map(n => [n.id, n]));

    const mapToD3Node = (n: ActiveNode): D3Node => {
      const existing = prevNodesMap.get(n.id);
      const savedPos = nodePositions?.[n.id];
      return {
        id: n.id,
        label: n.label,
        summary: n.summary,
        weight: n.weight,
        visibility_status: n.visibility_status,
        access_key_hash: n.access_key_hash || n.accessKeyHash,
        accessKeyHash: n.accessKeyHash || n.access_key_hash,
        doppelgangerId: n.doppelgangerId,
        ownerId: n.ownerId,
        x: (activeViewId === "default") ? undefined : (savedPos ? savedPos.x : (existing ? existing.x : undefined)),
        y: (activeViewId === "default") ? undefined : (savedPos ? savedPos.y : (existing ? existing.y : undefined)),
        vx: (activeViewId === "default") ? undefined : (existing ? existing.vx : undefined),
        vy: (activeViewId === "default") ? undefined : (existing ? existing.vy : undefined),
        fx: (activeViewId === "default") ? undefined : (savedPos ? savedPos.x : (existing ? existing.fx : undefined)),
        fy: (activeViewId === "default") ? undefined : (savedPos ? savedPos.y : (existing ? existing.fy : undefined)),
      };
    };

    const parentNodes = nodes.filter(n => n.weight === 3.0);
    const parentD3Nodes = parentNodes.map(mapToD3Node);

    // Compute distinct target coordinate positions for each Parent node to anchor toward in default collapsed state
    const numParents = parentD3Nodes.length;
    parentD3Nodes.forEach((parent, index) => {
      if (numParents <= 1) {
        (parent as any).targetGridX = width / 2;
        (parent as any).targetGridY = height / 2;
      } else {
        // Map symmetrically to screen quadrants (e.g., top-left, top-right, bottom-left, bottom-right)
        if (numParents === 4) {
          const xCoords = [width * 0.28, width * 0.72, width * 0.28, width * 0.72];
          const yCoords = [height * 0.28, height * 0.28, height * 0.72, height * 0.72];
          (parent as any).targetGridX = xCoords[index];
          (parent as any).targetGridY = yCoords[index];
        } else {
          // Symmetrical radial/quadrant map for dynamic counts
          const angle = (index / numParents) * 2 * Math.PI - Math.PI / 4;
          const radiusX = width * 0.28;
          const radiusY = height * 0.28;
          (parent as any).targetGridX = width / 2 + Math.cos(angle) * radiusX;
          (parent as any).targetGridY = height / 2 + Math.sin(angle) * radiusY;
        }
      }
    });

    // Build map of child D3Nodes for continuity
    const childD3Map = new Map<string, D3Node>();
    nodes.filter(n => n.weight < 3.0).forEach(cNode => {
      childD3Map.set(cNode.id, mapToD3Node(cNode));
    });

    // Handle interactive parent grouping assignment
    parentD3Nodes.forEach(pD3 => {
      const associatedActiveChildren = parentGroups.parentMap.get(pD3.id) || [];
      pD3._children = associatedActiveChildren.map(cNode => childD3Map.get(cNode.id)!);
    });

    // Populate active nodes: only Parents by default, and children of active parent if expanded
    const d3Nodes: D3Node[] = [...parentD3Nodes];
    if (expandedParentId) {
      const expandedParentNode = parentD3Nodes.find(p => p.id === expandedParentId);
      if (expandedParentNode && expandedParentNode._children) {
        d3Nodes.push(...expandedParentNode._children);
      }
    }

    // Capture unique node IDs currently in d3Nodes
    const seenNodeIds = new Set<string>(d3Nodes.map(n => n.id));

    // Support drawing shared nodes ALWAYS to prevent layout and structural data loss
    const sharedNodesFromProps = nodes.filter(n => (n as any).isShared === true);
    
    sharedNodesFromProps.forEach(sn => {
      if (seenNodeIds.has(sn.id)) return; // Prevent duplicate entries
      seenNodeIds.add(sn.id);

      const parentId = (sn as any).parentId;
      const existing = prevNodesMap.get(sn.id);
      const savedPos = nodePositions?.[sn.id];
      
      d3Nodes.push({
        id: sn.id,
        label: sn.label,
        summary: sn.summary,
        weight: sn.weight,
        visibility_status: sn.visibility_status,
        access_key_hash: sn.access_key_hash || sn.accessKeyHash,
        accessKeyHash: sn.accessKeyHash || sn.access_key_hash,
        isShared: true,
        ownerName: (sn as any).ownerName,
        ownerTitle: (sn as any).ownerTitle,
        ownerHandle: (sn as any).ownerHandle,
        doppelgangerId: (sn as any).doppelgangerId,
        ownerId: (sn as any).ownerId,
        connectedProject: (sn as any).connectedProject,
        relationshipSummary: (sn as any).relationshipSummary,
        relatedAreas: (sn as any).relatedAreas,
        parentId: parentId,
        x: (activeViewId === "default") ? undefined : (savedPos ? savedPos.x : (existing ? existing.x : undefined)),
        y: (activeViewId === "default") ? undefined : (savedPos ? savedPos.y : (existing ? existing.y : undefined)),
        vx: (activeViewId === "default") ? undefined : (existing ? existing.vx : undefined),
        vy: (activeViewId === "default") ? undefined : (existing ? existing.vy : undefined),
        fx: (activeViewId === "default") ? undefined : (savedPos ? savedPos.x : (existing ? existing.fx : undefined)),
        fy: (activeViewId === "default") ? undefined : (savedPos ? savedPos.y : (existing ? existing.fy : undefined)),
      } as any);
    });

    // Sort d3Nodes: shared nodes first so they are appended first and rendered BEHIND local nodes
    d3Nodes.sort((a, b) => {
      const aShared = (a as any).isShared ? 1 : 0;
      const bShared = (b as any).isShared ? 1 : 0;
      return bShared - aShared; // puts shared nodes (1) before local nodes (0)
    });

    d3NodesRef.current = d3Nodes;

    const activeNodeIds = new Set<string>(d3Nodes.map(n => n.id));

    // Build parent map from full edges dataset for structural ancestor resolution
    const parentMap = new Map<string, string>();
    edges.forEach(e => {
      parentMap.set(e.source, e.target);
    });

    // Helper to find the nearest ancestor node that is active in the current view
    const findActiveAncestor = (nodeId: string): string | null => {
      let current = nodeId;
      while (current) {
        if (activeNodeIds.has(current)) {
          return current;
        }
        const p = parentMap.get(current);
        if (!p || p === current) {
          break;
        }
        current = p;
      }
      return null;
    };

    const resolvedLinksMap = new Map<string, D3Link>();
    edges.forEach((e) => {
      const resolvedSource = findActiveAncestor(e.source);
      const resolvedTarget = findActiveAncestor(e.target);
      
      if (resolvedSource && resolvedTarget && resolvedSource !== resolvedTarget) {
        const linkKey = `${resolvedSource}->${resolvedTarget}`;
        resolvedLinksMap.set(linkKey, {
          source: resolvedSource,
          target: resolvedTarget,
          relation: e.relation,
        });
      }
    });
    const d3Links: D3Link[] = Array.from(resolvedLinksMap.values());

    // Clear previous elements
    const svgElement = d3.select(svgRef.current);

    // Capture the existing zoom transform to maintain camera continuity on selection/re-render
    let currentTransform = d3.zoomIdentity;
    try {
      const el = svgRef.current;
      if (el) {
        currentTransform = d3.zoomTransform(el);
      }
    } catch (e) {
      // ignore empty/uninitialized SVG state errors
    }

    svgElement.selectAll("*").remove();

    // Create container groups
    const g = svgElement.append("g");

    // Add zoom capability
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svgElement.call(zoom);

    // Setup force simulation
    const simulation = d3.forceSimulation<D3Node>(d3Nodes)
      .force(
        "link",
        d3.forceLink<D3Node, D3Link>(d3Links)
          .id((d) => d.id)
          .distance((link: any) => {
            const s = link.source as any;
            const t = link.target as any;
            const w1 = s?.weight;
            const w2 = t?.weight;
            
            const isRelatedToExpanded = expandedParentId && (
              s.id === expandedParentId || 
              t.id === expandedParentId || 
              parentGroups.parentOfNode.get(s.id) === expandedParentId || 
              parentGroups.parentOfNode.get(t.id) === expandedParentId
            );
            
            // Expand node links significantly (180px if focused, 120px default) to use the entire map area and keep text clear
            const BASE_UNIFORM_DISTANCE = isRelatedToExpanded ? 180 : 120;
            if ((w1 === 1.0 && w2 === 2.0) || (w1 === 2.0 && w2 === 1.0)) {
              return BASE_UNIFORM_DISTANCE * 0.75;
            }
            return BASE_UNIFORM_DISTANCE;
          })
      )
      .force("charge", d3.forceManyBody<D3Node>().strength((d: any) => {
        if (d.weight === 3.0) {
          if (expandedParentId) {
            if (d.id === expandedParentId) {
              return -600; // Strong active repulsion
            } else {
              return -1200; // Super strong repulsion to send other parents away
            }
          }
          return -600;
        }
        return -350; // Increased repulsion for children to spread out child text labels
      }))
      .force("x", d3.forceX<D3Node>()
        .x((d: any) => {
          if (d.weight === 3.0) {
            if (d.id === expandedParentId) {
              return width / 2;
            }
            if (expandedParentId) {
              // Push competitor parents way out to the edges
              const index = parentD3Nodes.findIndex(pn => pn.id === d.id);
              const angle = (index / numParents) * 2 * Math.PI;
              const radiusX = width * 0.75;
              return width / 2 + Math.cos(angle) * radiusX;
            }
            return d.targetGridX || (width / 2);
          }
          // Pull children toward their parent's coordinates
          const parentId = parentGroups.parentOfNode.get(d.id);
          if (parentId) {
            const parentObj = d3Nodes.find(pn => pn.id === parentId);
            return parentObj ? (parentObj.x ?? (width / 2)) : (width / 2);
          }
          return width / 2;
        })
        .strength((d: any) => {
          if (d.weight === 3.0) {
            if (d.id === expandedParentId) {
              return 0.45; // Firmly anchor focused parent in the center
            }
            return 0.3;
          }
          return 0.12;
        })
      )
      .force("y", d3.forceY<D3Node>()
        .y((d: any) => {
          if (d.weight === 3.0) {
            if (d.id === expandedParentId) {
              return height / 2;
            }
            if (expandedParentId) {
              // Push competitor parents way out to the edges
              const index = parentD3Nodes.findIndex(pn => pn.id === d.id);
              const angle = (index / numParents) * 2 * Math.PI;
              const radiusY = height * 0.75;
              return height / 2 + Math.sin(angle) * radiusY;
            }
            return d.targetGridY || (height / 2);
          }
          const parentId = parentGroups.parentOfNode.get(d.id);
          if (parentId) {
            const parentObj = d3Nodes.find(pn => pn.id === parentId);
            return parentObj ? (parentObj.y ?? (height / 2)) : (height / 2);
          }
          return height / 2;
        })
        .strength((d: any) => {
          if (d.weight === 3.0) {
            if (d.id === expandedParentId) {
              return 0.45;
            }
            return 0.3;
          }
          return 0.12;
        })
      )
      .force("collision", d3.forceCollide<D3Node>().radius((d: any) => {
        const rad = getParentRadius(d);
        if (d.weight === 3.0) {
          if (expandedParentId === d.id) {
            return rad + 65;
          }
          return Math.max(160, rad + 65); // Large macro separation to completely eliminate overlapping potential
        }
        return rad + 60; // Very generous collision padding to keep text clear of other nodes
      }));

    // Pre-calculate positions synchronously so bounds can be computed perfectly, 
    // avoiding initially clustered nodes at (0,0) or flying visual anomalies.
    for (let i = 0; i < 90; ++i) {
      simulation.tick();
    }

    // Calculate custom fit-to-view transform based on node coordinates at 1.0 scale
    const getFitTransform = () => {
      const activeClusterNodes = d3Nodes.filter((node) => {
        if (!expandedParentId) return true; // fit all if nothing is expanded
        return node.id === expandedParentId || parentGroups.parentOfNode.get(node.id) === expandedParentId;
      });

      if (activeClusterNodes.length === 0) return d3.zoomIdentity;

      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;

      activeClusterNodes.forEach((node) => {
        const x = node.x ?? (width / 2);
        const y = node.y ?? (height / 2);
        const rad = getParentRadius(node);
        const r = rad + 55; // padding margin
        if (x - r < minX) minX = x - r;
        if (x + r > maxX) maxX = x + r;
        if (y - r < minY) minY = y - r;
        if (y + r > maxY) maxY = y + r;
      });

      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      const dx = maxX - minX;
      const dy = maxY - minY;

      const paddingPercent = 0.85; // fit inside 85% of screen
      const scaleX = (width * paddingPercent) / dx;
      const scaleY = (height * paddingPercent) / dy;
      let scale = Math.min(scaleX, scaleY);

      // Nice bounded values for responsive zoom scales (not too far in, not too far out)
      scale = Math.max(0.5, Math.min(scale, 1.2));

      const tx = width / 2 - cx * scale;
      const ty = height / 2 - cy * scale;

      return d3.zoomIdentity.translate(tx, ty).scale(scale);
    };

    const prevResetTrigger = (svgElement as any)._prevResetTrigger || 0;
    const resetTriggered = resetTrigger !== undefined && resetTrigger !== prevResetTrigger;
    (svgElement as any)._prevResetTrigger = resetTrigger;

    // Determine the baseline/initial camera transform
    let baselineTransform = resetTriggered ? d3.zoomIdentity : currentTransform;
    const isFirstRender = !hasInitialFitRef.current;
    const countChanged = prevNodesCountRef.current !== d3Nodes.length;

    // Track expanded status change uniquely via internal SVG state tracker representation
    const prevExpandedParentId = (svgElement as any)._prevExpandedParentId || null;
    const expandedChanged = prevExpandedParentId !== expandedParentId;
    (svgElement as any)._prevExpandedParentId = expandedParentId;

    hasInitialFitRef.current = true;
    prevNodesCountRef.current = d3Nodes.length;

    if (isFirstRender) {
      baselineTransform = getFitTransform();
      svgElement.call(zoom.transform, baselineTransform);
    } else if (countChanged || expandedChanged || resetTriggered) {
      // Smooth transitional zoom focusing strictly on the expanded parent and its descendants
      baselineTransform = getFitTransform();
      svgElement.transition()
        .duration(855)
        .ease(d3.easeCubicOut)
        .call(zoom.transform, baselineTransform);
    } else {
      svgElement.call(zoom.transform, baselineTransform);
    }

    const isLocalNode = (nodeData: any) => {
      return activeDoppelgangerId && nodeData?.doppelgangerId 
        ? (nodeData.doppelgangerId === activeDoppelgangerId)
        : !nodeData?.isShared;
    };

    const isLocalNodeById = (nodeId: string) => {
      const n = nodes.find(x => x.id === nodeId);
      if (!n) return true;
      return activeDoppelgangerId && n?.doppelgangerId 
        ? (n.doppelgangerId === activeDoppelgangerId)
        : !(n as any).isShared;
    };

    // Draw Links
    const link = g.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(d3Links)
      .enter()
      .append("line")
      .attr("stroke", (d: any) => {
        const sourceId = typeof d.source === "object" ? d.source.id : d.source;
        const targetId = typeof d.target === "object" ? d.target.id : d.target;
        const sourceIsLocal = isLocalNodeById(sourceId);
        const targetIsLocal = isLocalNodeById(targetId);
        if (sourceIsLocal && targetIsLocal) {
          return getLinkColor(d);
        }
        return "#52525b"; // SHARED_GRAY
      })
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", (d: any) => {
        const sourceId = typeof d.source === "object" ? d.source.id : d.source;
        const targetId = typeof d.target === "object" ? d.target.id : d.target;
        const sourceIsLocal = isLocalNodeById(sourceId);
        const targetIsLocal = isLocalNodeById(targetId);
        return (sourceIsLocal && targetIsLocal) ? null : "3,3";
      })
      .attr("opacity", (d: any) => {
        const sourceId = typeof d.source === "object" ? d.source.id : d.source;
        const targetId = typeof d.target === "object" ? d.target.id : d.target;
        const sourceIsLocal = isLocalNodeById(sourceId);
        const targetIsLocal = isLocalNodeById(targetId);
        if (sourceIsLocal && targetIsLocal) {
          return 0.8;
        }
        return 0.35; // reduced opacity but consistent across all edges
      });

    // Draw Nodes
    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll<SVGGElement, D3Node>("g")
      .data(d3Nodes)
      .enter()
      .append("g")
      .attr("class", "node-group")
      .classed("is-selected", (d) => d.id === selectedNodeId)
      .style("cursor", "pointer")
      .on("click", (event, d: any) => {
        event.stopPropagation();
        
        // Manipulate non-spatial UI states directly in the D3 selection callback for instant, zero-flicker feedback
        svgElement.selectAll(".node-group").classed("is-selected", (nodeData: any) => nodeData.id === d.id);
        svgElement.selectAll(".node-outer-ring")
          .attr("stroke", (nodeData: any) => {
            if (nodeData.id === d.id) return isLocalNode(nodeData) ? "#2DD4BF" : "#a1a1aa";
            if (!isLocalNode(nodeData)) return "#52525b"; // SHARED_GRAY
            return getNodeColors(nodeData).stroke;
          });
        svgElement.selectAll(".node-circle")
          .attr("stroke", (nodeData: any) => {
            if (nodeData.id === d.id) return isLocalNode(nodeData) ? "#2DD4BF" : "#a1a1aa";
            if (!isLocalNode(nodeData)) return "#52525b"; // SHARED_GRAY
            return getNodeColors(nodeData).stroke;
          })
          .attr("stroke-width", (nodeData: any) => nodeData.id === d.id ? 3 : (nodeData.weight === 3.0 ? 2.5 : (nodeData.weight === 2.0 ? 1.5 : 1.0)))
          .attr("fill", (nodeData: any) => getNodeColors(nodeData).fill)
          .attr("opacity", (nodeData: any) => {
            if (nodeData.id === d.id) return 1.0;
            if (!isLocalNode(nodeData)) return 0.45;
            return 0.95;
          });
        svgElement.selectAll(".node-inner-core")
          .attr("fill", (nodeData: any) => {
            if (nodeData.id === d.id) return isLocalNode(nodeData) ? "#2DD4BF" : "#a1a1aa";
            if (!isLocalNode(nodeData)) return "#52525b"; // SHARED_GRAY
            return getNodeColors(nodeData).stroke;
          })
          .attr("opacity", (nodeData: any) => {
            if (nodeData.id === d.id) return 1.0;
            if (!isLocalNode(nodeData)) return 0.45;
            return 0.95;
          });
        svgElement.selectAll(".node-text")
          .attr("fill", (nodeData: any) => {
            if (nodeData.id === d.id) return isLocalNode(nodeData) ? "#2DD4BF" : "#e4e4e7";
            if (!isLocalNode(nodeData)) return "#71717a";
            return "#F4F4F5";
          })
          .attr("opacity", (nodeData: any) => {
            if (nodeData.id === d.id) return 1.0;
            if (!isLocalNode(nodeData)) return 0.45;
            return 1.0;
          });

        onSelectNode(d.id);

        if (d.weight === 3.0 && isLocalNode(d)) {
          // Toggle State & Auto Collapsing Competitors
          const isExpanding = expandedParentId !== d.id;
          setExpandedParentId(isExpanding ? d.id : null);
        }
      })
      .on("mouseover", function (event, d: any) {
        if (!isLocalNode(d)) {
          const gNode = d3.select(this);
          gNode.raise();
          
          gNode.select(".node-circle")
            .transition()
            .duration(150)
            .attr("opacity", 0.75)
            .attr("stroke", "#71717a")
            .attr("stroke-width", 2.2);
            
          gNode.select(".node-inner-core")
            .transition()
            .duration(150)
            .attr("opacity", 0.75);
            
          gNode.select(".node-text")
            .transition()
            .duration(150)
            .attr("opacity", 0.85)
            .attr("fill", "#a1a1aa");

          // Soft ambient highlight of connected relationship line
          svgElement.selectAll(".links line")
            .filter((linkData: any) => 
              (typeof linkData.source === "object" ? linkData.source.id : linkData.source) === d.id ||
              (typeof linkData.target === "object" ? linkData.target.id : linkData.target) === d.id
            )
            .transition()
            .duration(150)
            .attr("stroke", "#52525b")
            .style("stroke-dasharray", null) // solid
            .attr("stroke-width", 2.0)
            .attr("opacity", 0.6);
        }
      })
      .on("mouseout", function (event, d: any) {
        if (!isLocalNode(d)) {
          const gNode = d3.select(this);
          
          gNode.select(".node-circle")
            .transition()
            .duration(150)
            .attr("opacity", 0.45)
            .attr("stroke", "#52525b")
            .attr("stroke-width", d.id === selectedNodeId ? 3 : (d.weight === 3.0 ? 2.5 : (d.weight === 2.0 ? 1.5 : 1.0)));
            
          gNode.select(".node-inner-core")
            .transition()
            .duration(150)
            .attr("opacity", 0.45)
            .attr("fill", d.id === selectedNodeId ? "#71717a" : "#52525b");
            
          gNode.select(".node-text")
            .transition()
            .duration(150)
            .attr("opacity", 0.45)
            .attr("fill", d.id === selectedNodeId ? "#e4e4e7" : "#71717a");

          // Restore faint connection line style
          svgElement.selectAll(".links line")
            .filter((linkData: any) => 
              (typeof linkData.source === "object" ? linkData.source.id : linkData.source) === d.id ||
              (typeof linkData.target === "object" ? linkData.target.id : linkData.target) === d.id
            )
            .transition()
            .duration(150)
            .attr("stroke", "#52525b")
            .attr("stroke-width", 1.5)
            .attr("stroke-dasharray", "3,3")
            .attr("opacity", 0.35);
        }
      })
      .call(
        d3.drag<SVGGElement, D3Node>()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended)
      );

    // 1. Outer accent ring for Parent (weight === 3.0)
    const parents = node.filter((d) => d.weight === 3.0);
    parents.append("circle")
      .attr("class", "node-outer-ring")
      .attr("r", (d) => getParentRadius(d) * 1.25)
      .attr("fill", "none")
      .attr("stroke", (d) => {
        if (d.id === selectedNodeId) return isLocalNode(d) ? "#2DD4BF" : "#a1a1aa";
        if (!isLocalNode(d)) return "#52525b"; // SHARED_GRAY
        return getNodeColors(d).stroke;
      })
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", (d) => {
        const locked = isNodeLocked(d, unlockedTokens, parentGroups.parentOfNode, nodes);
        return locked ? "5,5" : null;
      })
      .attr("opacity", (d) => {
        if (d.id === selectedNodeId) return 0.6;
        if (!isLocalNode(d)) return 0.45;
        const colors = getNodeColors(d);
        return colors.family === "red" ? 0.4 : 0.25;
      });

    // 2. Main concentric filled circles with progressive color depths
    node.append("circle")
      .attr("class", "node-circle")
      .attr("r", (d) => getParentRadius(d))
      .attr("fill", (d) => getNodeColors(d).fill)
      .attr("stroke", (d) => {
        if (d.id === selectedNodeId) return isLocalNode(d) ? "#2DD4BF" : "#a1a1aa";
        if (!isLocalNode(d)) return "#52525b"; // SHARED_GRAY
        return getNodeColors(d).stroke;
      })
      .attr("stroke-width", (d) => {
        if (d.id === selectedNodeId) return 3;
        return d.weight === 3.0 ? 2.5 : (d.weight === 2.0 ? 1.5 : 1.0);
      })
      .attr("stroke-dasharray", (d) => {
        const locked = isNodeLocked(d, unlockedTokens, parentGroups.parentOfNode, nodes);
        return locked ? "4,4" : null;
      })
      .attr("opacity", (d) => {
        if (d.id === selectedNodeId) return 1.0;
        if (!isLocalNode(d)) return 0.45;
        return 0.95;
      });

    // 3. Inner core filled circles
    node.append("circle")
      .attr("class", "node-inner-core")
      .attr("r", (d) => {
        if (d.weight === 3.0) return 8;
        if (d.weight === 2.0) return 5;
        return 2.5;
      })
      .attr("fill", (d) => {
        if (d.id === selectedNodeId) return isLocalNode(d) ? "#2DD4BF" : "#a1a1aa";
        if (!isLocalNode(d)) return "#52525b"; // SHARED_GRAY
        return getNodeColors(d).stroke;
      })
      .attr("opacity", (d) => {
        if (d.id === selectedNodeId) return 1.0;
        if (!isLocalNode(d)) return 0.45;
        return 0.95;
      });

    // Subtle lock icon path for gated/passphrase nodes
    const gatedNodes = node.filter((d) => d.visibility_status === "isolated_passphrase");
    gatedNodes.append("path")
      .attr("d", (d) => {
        const key = (d.access_key_hash || d.accessKeyHash || "").toUpperCase().trim();
        const hasAccess = unlockedTokens.includes(key);
        return hasAccess 
          ? "M-3,-2 L-3,-5 A3,3 0 0,1 3,-5 L3,-2 M-5,-2 L5,-2 L5,5 L-5,5 Z" 
          : "M-4,-2 L-4,-6 A4,4 0 0,1 4,-6 L4,-2 M-5,-2 L5,-2 L5,5 L-5,5 Z";
      })
      .attr("fill", (d) => {
        if (d.id === selectedNodeId) return isLocalNode(d) ? "#2DD4BF" : "#a1a1aa";
        if (!isLocalNode(d)) return "#52525b"; // SHARED_GRAY
        return getNodeColors(d).stroke;
      })
      .attr("stroke-width", 0)
      .attr("transform", "scale(1.3) translate(0, -1)");

    // Node Text Labels (Enlarged and optimized for legibility)
    node.append("text")
      .attr("class", "node-text")
      .attr("dy", (d) => getParentRadius(d) + 24)
      .attr("text-anchor", "middle")
      .attr("font-family", "Inter, sans-serif")
      .attr("font-weight", "600")
      .attr("font-size", "13px")
      .attr("stroke", "#0D0D0F")
      .attr("stroke-width", "3.5px")
      .attr("stroke-linejoin", "round")
      .attr("paint-order", "stroke fill")
      .attr("fill", (d) => {
        if (d.id === selectedNodeId) return isLocalNode(d) ? "#2DD4BF" : "#e4e4e7";
        if (!isLocalNode(d)) return "#71717a";
        return "#F4F4F5";
      })
      .attr("opacity", (d) => {
        if (d.id === selectedNodeId) return 1.0;
        if (!isLocalNode(d)) return 0.45;
        return 1.0;
      })
      .text((d) => d.label);

    // Summary subtitles on node hover / mini size
    node.append("title")
      .text((d) => `${d.label}: ${d.summary}`);

    // Simulation ticks
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Drag handlers
    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;

      const currentPositions: { [nodeId: string]: { x: number; y: number } } = {};
      d3Nodes.forEach(node => {
        if (node.x !== undefined && node.y !== undefined) {
          currentPositions[node.id] = { x: node.x, y: node.y };
        }
      });
      onStartDragging?.(currentPositions);
    }

    function dragged(event: any, d: any) {
      if (d.weight === 3.0) {
        let overlaps = false;
        const rD = getParentRadius(d);
        for (const other of d3Nodes) {
          if (other.id !== d.id && other.weight === 3.0) {
            const rOther = getParentRadius(other);
            const otherX = other.x ?? 0;
            const otherY = other.y ?? 0;
            const dist = Math.hypot(event.x - otherX, event.y - otherY);
            // safe distance is the sum of radii + 15px safe padding
            if (dist < (rD + rOther + 15)) {
              overlaps = true;
              break;
            }
          }
        }
        if (overlaps) {
          return; // Stop update to prevent Level 1 overlap
        }
      }

      d.fx = event.x;
      d.fy = event.y;
      d.x = event.x;
      d.y = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      
      // Do not snap back: keep d.fx and d.fy set to current position
      d.fx = d.x;
      d.fy = d.y;

      const currentPositions: { [nodeId: string]: { x: number; y: number } } = {};
      d3Nodes.forEach(node => {
        if (node.x !== undefined && node.y !== undefined) {
          currentPositions[node.id] = { x: node.x, y: node.y };
        }
      });
      onNodeDragged?.(currentPositions);
    }

    // Sync selected node history ref without any automated panning/scrolling
    const prevSelectedNodeId = prevSelectedNodeIdRef.current;
    if (selectedNodeId !== prevSelectedNodeId) {
      prevSelectedNodeIdRef.current = selectedNodeId;
    }

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, dimensions, expandedParentId, parentGroups, activeViewId, resetTrigger]);

  // Instantly sync visual selection styles in D3 DOM on selectedNodeId or unlockedTokens change
  useEffect(() => {
    if (!svgRef.current) return;
    const svgElement = d3.select(svgRef.current);

    const isLocalNode = (nodeData: any) => {
      return activeDoppelgangerId && nodeData?.doppelgangerId 
        ? (nodeData.doppelgangerId === activeDoppelgangerId)
        : !nodeData?.isShared;
    };

    svgElement.selectAll<SVGGElement, D3Node>(".node-group")
      .classed("is-selected", (d) => d.id === selectedNodeId);

    svgElement.selectAll<SVGCircleElement, D3Node>(".node-outer-ring")
      .attr("stroke", (d) => {
        if (d.id === selectedNodeId) return isLocalNode(d) ? "#2DD4BF" : "#a1a1aa";
        if (!isLocalNode(d)) return "#52525b"; // SHARED_GRAY
        return getNodeColors(d).stroke;
      })
      .attr("stroke-dasharray", (d) => {
        const locked = isNodeLocked(d, unlockedTokens, parentGroups.parentOfNode, nodes);
        return locked ? "5,5" : null;
      })
      .attr("opacity", (d) => {
        if (d.id === selectedNodeId) return 0.6;
        if (!isLocalNode(d)) return 0.45;
        const colors = getNodeColors(d);
        return colors.family === "red" ? 0.4 : 0.25;
      });

    svgElement.selectAll<SVGCircleElement, D3Node>(".node-circle")
      .attr("stroke", (d) => {
        if (d.id === selectedNodeId) return isLocalNode(d) ? "#2DD4BF" : "#a1a1aa";
        if (!isLocalNode(d)) return "#52525b"; // SHARED_GRAY
        return getNodeColors(d).stroke;
      })
      .attr("stroke-width", (d) => {
        if (d.id === selectedNodeId) return 3;
        return d.weight === 3.0 ? 2.5 : (d.weight === 2.0 ? 1.5 : 1.0);
      })
      .attr("stroke-dasharray", (d) => {
        const locked = isNodeLocked(d, unlockedTokens, parentGroups.parentOfNode, nodes);
        return locked ? "4,4" : null;
      })
      .attr("fill", (d) => getNodeColors(d).fill)
      .attr("opacity", (d) => {
        if (d.id === selectedNodeId) return 1.0;
        if (!isLocalNode(d)) return 0.45;
        return 0.95;
      });

    svgElement.selectAll<SVGCircleElement, D3Node>(".node-inner-core")
      .attr("fill", (d) => {
        if (d.id === selectedNodeId) return isLocalNode(d) ? "#2DD4BF" : "#a1a1aa";
        if (!isLocalNode(d)) return "#52525b"; // SHARED_GRAY
        return getNodeColors(d).stroke;
      })
      .attr("opacity", (d) => {
        if (d.id === selectedNodeId) return 1.0;
        if (!isLocalNode(d)) return 0.45;
        return 0.95;
      });

    svgElement.selectAll<SVGTextElement, D3Node>(".node-text")
      .attr("fill", (d) => {
        if (d.id === selectedNodeId) return isLocalNode(d) ? "#2DD4BF" : "#e4e4e7";
        if (!isLocalNode(d)) return "#71717a";
        return "#F4F4F5";
      })
      .attr("opacity", (d) => {
        if (d.id === selectedNodeId) return 1.0;
        if (!isLocalNode(d)) return 0.45;
        return 1.0;
      });
  }, [selectedNodeId, unlockedTokens, nodes, parentGroups, activeDoppelgangerId]);

  return (
    <div
      ref={containerRef}
      id="d3-canvas-parent"
      className="w-full h-full relative overflow-hidden bg-[#0D0D0F] flex items-center justify-center min-h-[360px]"
    >
      {/* Radial Grid Backdrop */}
      <div className="absolute inset-0 opacity-[0.12] bg-[radial-gradient(#27272A_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      {nodes.length === 0 ? (
        <div className="text-zinc-600 font-mono text-xs flex flex-col items-center gap-2 z-10">
          <span>[ No Active Nodes Rendered ]</span>
          <span className="text-center px-4 max-w-xs text-zinc-500">
            Click &quot;Bootstrap Local Graph&quot; or write a journal entry to begin.
          </span>
        </div>
      ) : (
        <>
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            className="absolute inset-0 w-full h-full z-10"
          />
        </>
      )}
      {/* Visual legends overlay */}
      {nodes.length > 0 && (
        <div
          onMouseEnter={() => setIsLegendExpanded(true)}
          onMouseLeave={() => setIsLegendExpanded(false)}
          className={`absolute bottom-3 right-3 bg-[#141417]/95 backdrop-blur border border-[#27272A] rounded-xl text-[10px] font-mono text-zinc-400 z-30 shadow-2xl transition-all duration-300 ease-in-out select-none cursor-default overflow-hidden ${
            isLegendExpanded 
              ? "p-3.5 w-[140px]" 
              : "p-2 px-2.5 w-[100px]"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between font-bold">
            <span>Nodes:</span>
            <span className="text-[#2DD4BF] font-bold">{nodes.length}</span>
          </div>

          {/* Sliding up legend section */}
          <div
            className={`transition-all duration-300 ease-in-out border-zinc-800 space-y-2 overflow-hidden ${
              isLegendExpanded 
                ? "max-h-28 opacity-100 border-t pt-2.5 mt-2.5" 
                : "max-h-0 opacity-0 border-t-0 pt-0 mt-0"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#141417] border border-[#52525b] inline-block shadow-[0_0_4px_#52525b]"></span>
                <span className="text-zinc-400">Related:</span>
              </div>
              <span className="text-zinc-500 font-bold">{String(relatedCount).padStart(2, '0')}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#141417] border border-[#ec4899] inline-block border-dashed"></span>
                <span className="text-pink-400">Private:</span>
              </div>
              <span className="text-pink-400 font-bold">{String(privateCount).padStart(2, '0')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
