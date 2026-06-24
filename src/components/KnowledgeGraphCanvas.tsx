import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { ActiveNode, Edge, stripLabelNumbering, classifyNodeLevel, formatNodeLabel } from "../types";

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
  workflowMode?: 'v1' | 'v2';
  systemHasNodes?: boolean;
  citedNodeIds?: string[];
  activeView?: 'owner' | 'visitor' | 'admin';
}

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  summary: string;
  weight: number;
  level?: number;
  priority?: number;
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
  isNew?: boolean;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  id: string;
  source: string | D3Node;
  target: string | D3Node;
  relation?: string;
}

function getNodeLevel(n: any): number {
  if (!n) return 3;
  if (n.level !== undefined) {
    if (typeof n.level === "number") {
      return n.level;
    }
    if (n.level && typeof n.level === "object" && typeof n.level.value === "number") {
      return n.level.value;
    }
  }
  return classifyNodeLevel(n.label || "", "");
}

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
  return PROJECT_COLORS[family] || "#8B5CF6";
}

function getGlobalNodeColors(d: any, activeDoppelgangerId?: string): { fill: string; stroke: string; family: 'cyan' | 'red' | 'emerald' | 'amber' | 'violet' } {
  const idStrRaw = String(d?.id || "");
  const isLocalNode = idStrRaw.startsWith("shared-")
    ? false
    : (activeDoppelgangerId && d?.doppelgangerId 
        ? (d.doppelgangerId === activeDoppelgangerId)
        : !d?.isShared);

  if (!isLocalNode) {
    return {
      fill: "#1f1f23",
      stroke: "#52525b",
      family: "violet"
    };
  }

  const idStr = d?.id || "";
  const lvl = d?.level !== undefined ? d?.level : (d?.weight >= 2.5 ? 1 : (d?.weight >= 1.5 ? 2 : 3));

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
      parent: { fill: '#2e1065', stroke: '#a78bfa' },
      child: { fill: '#1e1b4b', stroke: '#818cf8' },
      grandchild: { fill: '#0f172a', stroke: '#6366f1' }
    }
  };

  const currentFamily = schemes[family];
  if (lvl === 1) return { ...currentFamily.parent, family };
  if (lvl === 2) return { ...currentFamily.child, family };
  return { ...currentFamily.grandchild, family };
}

function getGlobalLinkColor(link: any, activeDoppelgangerId?: string): string {
  const sourceId = typeof link.source === "object" ? link.source.id : link.source;
  const targetId = typeof link.target === "object" ? link.target.id : link.target;
  const idStr = sourceId || targetId || "";

  if (idStr.includes("1.")) return "#22d3ee";
  if (idStr.includes("2.")) return "#f43f5e";
  if (idStr.includes("3.")) return "#34d399";
  if (idStr.includes("4.")) return "#fbbf24";
  return "#a78bfa";
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
  workflowMode = 'v1',
  systemHasNodes = true,
  citedNodeIds = [],
  activeView = 'visitor',
}: KnowledgeGraphCanvasProps) {
  const getProjectFamily = (nodeData: any): 'cyan' | 'red' | 'emerald' | 'amber' | 'violet' => {
    if (!nodeData) return 'violet';
    const idStr = String(nodeData.id || "");
    if (idStr.includes("1.")) return 'cyan';
    if (idStr.includes("2.")) return 'red';
    if (idStr.includes("3.")) return 'emerald';
    if (idStr.includes("4.")) return 'amber';

    if (nodeData.parentId) {
      const pId = String(nodeData.parentId);
      if (pId.includes("1.")) return 'cyan';
      if (pId.includes("2.")) return 'red';
      if (pId.includes("3.")) return 'emerald';
      if (pId.includes("4.")) return 'amber';
    }

    if (edges && edges.length > 0) {
      const visited = new Set<string>();
      const queue: string[] = [nodeData.id];
      visited.add(nodeData.id);
      while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (currentId.includes("1.")) return 'cyan';
        if (currentId.includes("2.")) return 'red';
        if (currentId.includes("3.")) return 'emerald';
        if (currentId.includes("4.")) return 'amber';
        for (const edge of edges) {
          const sId = typeof edge.source === 'object' ? edge.source.id : edge.source;
          const tId = typeof edge.target === 'object' ? edge.target.id : edge.target;
          if (sId === currentId && !visited.has(tId)) {
            visited.add(tId);
            queue.push(tId);
          }
          if (tId === currentId && !visited.has(sId)) {
            visited.add(sId);
            queue.push(sId);
          }
        }
      }
    }

    const connectedProj = String(nodeData.connectedProject || "").toLowerCase();
    if (connectedProj.includes("mobile") || connectedProj.includes("redesign")) return 'cyan';
    if (connectedProj.includes("kinetic") || connectedProj.includes("type") || connectedProj.includes("motion")) return 'red';
    if (connectedProj.includes("design sprint") || connectedProj.includes("sprints planning")) return 'emerald';
    if (connectedProj.includes("branding")) return 'amber';

    return 'violet';
  };

  const getNodeColors = (d: any) => {
    const baseColors = getGlobalNodeColors(d, activeDoppelgangerId);
    const idStr = String(d?.id || "");
    const isLocal = idStr.startsWith("shared-")
      ? false
      : (activeDoppelgangerId && d?.doppelgangerId 
          ? (d.doppelgangerId === activeDoppelgangerId)
          : !d?.isShared);

    if (workflowMode === 'v2') {
      const lvl = d?.level !== undefined ? d?.level : (d?.weight >= 2.5 ? 1 : (d?.weight >= 1.5 ? 2 : 3));
      const family = getProjectFamily(d);
      
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
          parent: { fill: '#2e1065', stroke: '#a78bfa' },
          child: { fill: '#1e1b4b', stroke: '#818cf8' },
          grandchild: { fill: '#0f172a', stroke: '#6366f1' }
        }
      };
      const currentFamily = schemes[family];
      const actualColors = lvl === 1 
        ? { ...currentFamily.parent, family } 
        : (lvl === 2 ? { ...currentFamily.child, family } : { ...currentFamily.grandchild, family });

      if (citedNodeIds && citedNodeIds.length > 0) {
        if (!citedNodeIds.includes(d.id)) {
          return {
            fill: "#1f1f23",
            stroke: "#52525b",
            family
          };
        }
      }
      return actualColors;
    }

    if (workflowMode === 'v2' && citedNodeIds && citedNodeIds.length > 0) {
      if (!citedNodeIds.includes(d.id) && !isLocal) {
        return {
          fill: "#374151",
          stroke: "#4B5563",
          family: baseColors.family
        };
      }
    }
    return baseColors;
  };

  const getLinkColor = (link: any) => {
    const sId = typeof link.source === "object" ? link.source.id : link.source;
    const tId = typeof link.target === "object" ? link.target.id : link.target;

    if (workflowMode === 'v2') {
      if (citedNodeIds && citedNodeIds.length > 0) {
        const isSourceCited = citedNodeIds.includes(sId);
        const isTargetCited = citedNodeIds.includes(tId);
        if (!isSourceCited || !isTargetCited) {
          // Connections to/from inactive nodes must be gray
          return "#52525b";
        }
      }
      const familyColors = {
        cyan: "#22d3ee",
        red: "#f43f5e",
        emerald: "#34d399",
        amber: "#fbbf24",
        violet: "#a78bfa"
      };
      const sourceNodeData = stagedNodes.find(n => n.id === sId);
      const family = getProjectFamily(sourceNodeData);
      return familyColors[family] || "#a78bfa";
    }

    return getGlobalLinkColor(link, activeDoppelgangerId);
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });

  const [expandedParentId, setExpandedParentId] = useState<string | null>(null);

  const activeViewRef = useRef(activeView);
  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  const onSelectNodeRef = useRef(onSelectNode);
  useEffect(() => {
    onSelectNodeRef.current = onSelectNode;
  }, [onSelectNode]);

  const selectedNodeIdRef = useRef<string | null>(selectedNodeId);
  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  const hasInitialFitRef = useRef(false);
  const prevNodesCountRef = useRef(0);
  const prevSidebarOpenRef = useRef(false);

  // Persistent reference for simulation nodes coordinates
  const d3NodesRef = useRef<D3Node[]>([]);
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);

  const [stagedNodes, setStagedNodes] = useState<any[]>(nodes);
  const [stagedEdges, setStagedEdges] = useState<any[]>(edges);

  useEffect(() => {
    setStagedNodes(nodes);
    setStagedEdges(edges);
  }, [nodes, edges]);

  // Synchronously auto-expand parent when a child node is selected externally, or reset when cleared
  useEffect(() => {
    if (workflowMode === 'v2') {
      setExpandedParentId(null);
      return;
    }
    if (selectedNodeId) {
      const nodeObj = stagedNodes.find(n => n.id === selectedNodeId);
      if (nodeObj) {
        let currentId = selectedNodeId;
        let lvl1Id = "";
        let safety = 0;
        while (safety < 10) {
          safety++;
          const targetObj = stagedNodes.find(n => n.id === currentId);
          if (!targetObj) break;
          if (getNodeLevel(targetObj) === 1) {
            lvl1Id = currentId;
            break;
          }
          const upId = parentGroups.parentOfNode.get(currentId);
          if (upId) {
            currentId = upId;
          } else {
            break;
          }
        }
        if (lvl1Id) {
          setExpandedParentId(lvl1Id);
        }
      }
    } else {
      setExpandedParentId(null);
    }
  }, [selectedNodeId, stagedNodes, workflowMode]);

  useEffect(() => {
    setExpandedParentId(null);
  }, [activeDoppelgangerId, resetTrigger]);

  const getParentRadius = (d: any) => {
    const lvl = getNodeLevel(d);
    if (lvl === 1) return 36;
    if (lvl === 2) return 28;
    return 20;
  };

  const parentGroups = useMemo(() => {
    const parentOfNode = new Map<string, string>();
    const parentMap = new Map<string, ActiveNode[]>();

    const rootNodes = stagedNodes.filter(n => getNodeLevel(n) === 1);
    rootNodes.forEach(pn => {
      parentMap.set(pn.id, []);
    });

    stagedEdges.forEach(edge => {
      if (edge.relation === "child_of") {
        const childId = typeof edge.source === "object" ? edge.source.id : edge.source;
        const parentId = typeof edge.target === "object" ? edge.target.id : edge.target;
        parentOfNode.set(childId, parentId);
        if (parentMap.has(parentId)) {
          const childNode = stagedNodes.find(n => n.id === childId);
          if (childNode) {
            parentMap.get(parentId)!.push(childNode);
          }
        }
      }
    });

    stagedNodes.forEach(n => {
      const isSharedNode = (n as any).isShared === true || String(n.id).startsWith("shared-");
      if (getNodeLevel(n) > 1 && !parentOfNode.has(n.id) && !isSharedNode) {
        let matchedParent = rootNodes.find(pn => {
          const pFamily = getFamilyNumber(pn.id);
          const nFamily = getFamilyNumber(n.id);
          return pFamily !== "default" && pFamily === nFamily;
        });
        if (matchedParent) {
          parentOfNode.set(n.id, matchedParent.id);
          parentMap.get(matchedParent.id)!.push(n);
        }
      }
    });

    stagedNodes.forEach(n => {
      const isSharedNode = (n as any).isShared === true || String(n.id).startsWith("shared-");
      if (isSharedNode && (n as any).parentId) {
        parentOfNode.set(n.id, (n as any).parentId);
      }
    });

    return { parentMap, parentOfNode };
  }, [stagedNodes, stagedEdges]);

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

  const isLocalNode = (nodeData: any) => {
    if (!nodeData) return false;
    if (workflowMode === 'v2' && citedNodeIds && citedNodeIds.length > 0) {
      return citedNodeIds.includes(nodeData.id);
    }
    const idStr = String(nodeData.id || "");
    if (idStr.startsWith("shared-")) return false;
    const handle = nodeData.doppelgangerHandle || nodeData.doppelgangerId || "";
    if (activeDoppelgangerId && handle) {
      return handle === activeDoppelgangerId;
    }
    return !nodeData?.isShared;
  };

  // Main rendering D3 join cycle
  useEffect(() => {
    if (!svgRef.current) return;
    const svgElement = d3.select(svgRef.current);

    // Enforce strict V2 null-state check before rendering anything
    if (workflowMode === 'v2' && activeViewRef.current !== 'owner' && (!citedNodeIds || citedNodeIds.length === 0)) {
      if (simulationRef.current) {
        simulationRef.current.nodes([]);
        simulationRef.current.stop();
      }
      svgElement.selectAll("*").remove();
      const cc = d3.select("#canvas-container");
      if (!cc.empty()) {
        cc.style("opacity", 0).style("pointer-events", "none");
      }
      return;
    }

    if (stagedNodes.length === 0) return;

    const { width, height } = dimensions;

    // Create persistent DOM layers
    let mainG = svgElement.select<SVGGElement>("g.main-container");
    if (mainG.empty()) {
      mainG = svgElement.append("g").attr("class", "main-container");
    }

    let linksG = mainG.select<SVGGElement>("g.links-container");
    if (linksG.empty()) {
      linksG = mainG.append("g").attr("class", "links-container");
    }

    let nodesG = mainG.select<SVGGElement>("g.nodes-container");
    if (nodesG.empty()) {
      nodesG = mainG.append("g").attr("class", "nodes-container");
    }

    // Set up D3 Zoom once
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        mainG.attr("transform", event.transform);
        if (activeDoppelgangerId) {
          if (!(window as any)._lastZoomByProfile) {
            (window as any)._lastZoomByProfile = {};
          }
          (window as any)._lastZoomByProfile[activeDoppelgangerId] = event.transform;
        }
      });
    svgElement.call(zoom);

    // Resolve node coordinates from previous rendering cycle to ensure continuity
    const prevNodesMap = new Map<string, D3Node>(d3NodesRef.current.map(n => [n.id, n]));

    const rootActiveNodes = stagedNodes.filter(n => getNodeLevel(n) === 1);
    const childActiveNodes = stagedNodes.filter(n => {
      const isSharedNode = (n as any).isShared === true || String(n.id).startsWith("shared-");
      return getNodeLevel(n) > 1 && !isSharedNode;
    });

    const mapToD3Node = (n: any): D3Node => {
      const existing = prevNodesMap.get(n.id);
      const savedPos = nodePositions?.[n.id];
      const isNewNode = !existing;
      return {
        id: n.id,
        label: n.label,
        summary: n.summary,
        weight: n.weight,
        visibility_status: n.visibility_status,
        access_key_hash: n.access_key_hash || n.accessKeyHash,
        accessKeyHash: n.accessKeyHash || n.access_key_hash,
        isShared: n.isShared,
        ownerName: n.ownerName,
        ownerTitle: n.ownerTitle,
        doppelgangerId: n.doppelgangerId,
        ownerId: n.ownerId,
        x: savedPos ? savedPos.x : (existing ? existing.x : undefined),
        y: savedPos ? savedPos.y : (existing ? existing.y : undefined),
        vx: existing ? existing.vx : undefined,
        vy: existing ? existing.vy : undefined,
        fx: savedPos ? savedPos.x : (existing ? existing.fx : undefined),
        fy: savedPos ? savedPos.y : (existing ? existing.fy : undefined),
        isNew: isNewNode,
      };
    };

    const parentD3Nodes = rootActiveNodes.map(mapToD3Node);
    const childD3Map = new Map<string, D3Node>(
      childActiveNodes.map(cNode => [cNode.id, mapToD3Node(cNode)])
    );

    parentD3Nodes.forEach(pD3 => {
      const associatedActiveChildren = parentGroups.parentMap.get(pD3.id) || [];
      pD3._children = associatedActiveChildren.map(cNode => childD3Map.get(cNode.id)!);
    });

    const d3Nodes: D3Node[] = [...parentD3Nodes];
    const isOwner = activeView === 'owner';
    if (workflowMode === 'v2' && !isOwner) {
      parentD3Nodes.forEach(pN => {
        if (pN._children) {
          d3Nodes.push(...pN._children);
        }
      });
    } else if (expandedParentId) {
      const expandedParentNode = parentD3Nodes.find(p => p.id === expandedParentId);
      if (expandedParentNode && expandedParentNode._children) {
        d3Nodes.push(...expandedParentNode._children);
      }
    }

    const seenNodeIds = new Set<string>(d3Nodes.map(n => n.id));
    const sharedNodesFromProps = stagedNodes.filter(n => (n as any).isShared === true || String(n.id).startsWith("shared-"));
    sharedNodesFromProps.forEach(sn => {
      if (seenNodeIds.has(sn.id)) return;
      seenNodeIds.add(sn.id);
      d3Nodes.push(mapToD3Node(sn));
    });

    d3NodesRef.current = d3Nodes;

    const resolvedLinksMap = new Map<string, D3Link>();
    stagedEdges.forEach(edge => {
      const sId = typeof edge.source === 'object' ? (edge.source as any).id : edge.source;
      const tId = typeof edge.target === 'object' ? (edge.target as any).id : edge.target;

      const sourceExists = d3Nodes.some(n => n.id === sId);
      const targetExists = d3Nodes.some(n => n.id === tId);

      if (sourceExists && targetExists) {
        const linkKey = `${sId}->${tId}`;
        resolvedLinksMap.set(linkKey, {
          id: linkKey,
          source: sId,
          target: tId,
          relation: edge.relation,
        });
      }
    });

    parentGroups.parentOfNode.forEach((parentId, childId) => {
      const sourceExists = d3Nodes.some(n => n.id === childId);
      const targetExists = d3Nodes.some(n => n.id === parentId);
      if (sourceExists && targetExists) {
        const linkKey = `${childId}->${parentId}`;
        if (!resolvedLinksMap.has(linkKey)) {
          resolvedLinksMap.set(linkKey, {
            id: linkKey,
            source: childId,
            target: parentId,
            relation: "child_of",
          });
        }
      }
    });

    const d3Links = Array.from(resolvedLinksMap.values());

    // Setup or reuse force simulation
    let simulation = simulationRef.current;
    if (!simulation) {
      simulation = d3.forceSimulation<D3Node>();
      simulationRef.current = simulation;
    }

    const linkForce = d3.forceLink<D3Node, D3Link>().id((d) => d.id);
    
    simulation
      .force("link", linkForce)
      .force("charge", d3.forceManyBody<D3Node>().strength((d: any) => {
        if (getNodeLevel(d) === 1) {
          if (expandedParentId) {
            return d.id === expandedParentId ? -150 : -250;
          }
          return -150;
        }
        return -50;
      }))
      .force("x", d3.forceX<D3Node>()
        .x((d: any) => {
          if (getNodeLevel(d) === 1) {
            if (d.id === expandedParentId) return width / 2;
            if (expandedParentId) {
              const index = parentD3Nodes.findIndex(pn => pn.id === d.id);
              const angle = (index / parentD3Nodes.length) * 2 * Math.PI;
              return width / 2 + Math.cos(angle) * (width * 0.45);
            }
            return d.targetGridX || (width / 2);
          }
          const parentId = parentGroups.parentOfNode.get(d.id);
          if (parentId) {
            const parentObj = d3Nodes.find(pn => pn.id === parentId);
            return parentObj ? (parentObj.x ?? (width / 2)) : (width / 2);
          }
          return width / 2;
        })
        .strength((d: any) => {
          if (getNodeLevel(d) === 1) {
            return d.id === expandedParentId ? 0.45 : 0.3;
          }
          return 0.15;
        })
      )
      .force("y", d3.forceY<D3Node>()
        .y((d: any) => {
          if (getNodeLevel(d) === 1) {
            if (d.id === expandedParentId) return height / 2;
            if (expandedParentId) {
              const index = parentD3Nodes.findIndex(pn => pn.id === d.id);
              const angle = (index / parentD3Nodes.length) * 2 * Math.PI;
              return height / 2 + Math.sin(angle) * (height * 0.45);
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
          if (getNodeLevel(d) === 1) {
            return d.id === expandedParentId ? 0.45 : 0.3;
          }
          return 0.15;
        })
      )
      .force("collision", d3.forceCollide<D3Node>().radius((d: any) => {
        const rad = getParentRadius(d);
        if (getNodeLevel(d) === 1) {
          return expandedParentId === d.id ? rad + 32 : Math.max(80, rad + 35);
        }
        return rad + 24;
      }));

    simulation.nodes(d3Nodes);
    linkForce.links(d3Links);

    // Sync calculate ticks for initial layout seeding
    for (let i = 0; i < 90; ++i) {
      simulation.tick();
    }

    // Fit Transform Zoom Calculations
    const getFitTransform = () => {
      const activeClusterNodes = d3Nodes.filter((node) => {
        if (!expandedParentId) return true;
        return node.id === expandedParentId || parentGroups.parentOfNode.get(node.id) === expandedParentId;
      });

      if (activeClusterNodes.length === 0) return d3.zoomIdentity;

      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;

      activeClusterNodes.forEach((node) => {
        const x = node.x ?? (width / 2);
        const y = node.y ?? (height / 2);
        const rad = getParentRadius(node);
        const r = rad + 55;
        if (x - r < minX) minX = x - r;
        if (x + r > maxX) maxX = x + r;
        if (y - r < minY) minY = y - r;
        if (y + r > maxY) maxY = y + r;
      });

      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const dx = maxX - minX;
      const dy = maxY - minY;

      const paddingPercent = 0.85;
      const scaleX = (width * paddingPercent) / dx;
      const scaleY = (height * paddingPercent) / dy;
      let scale = Math.min(scaleX, scaleY);
      scale = Math.max(0.5, Math.min(scale, 1.2));

      const tx = width / 2 - cx * scale;
      const ty = height / 2 - cy * scale;

      return d3.zoomIdentity.translate(tx, ty).scale(scale);
    };

    const isFirstRender = !hasInitialFitRef.current;
    const prevActiveDoppelgangerId = (svgElement as any)._prevActiveDoppelgangerId || null;
    const activeDoppelgangerIdChanged = prevActiveDoppelgangerId !== activeDoppelgangerId;
    (svgElement as any)._prevActiveDoppelgangerId = activeDoppelgangerId;

    const prevWidth = (svgElement as any)._prevWidth || 0;
    const prevHeight = (svgElement as any)._prevHeight || 0;
    const sizeChanged = prevWidth !== width || prevHeight !== height;
    (svgElement as any)._prevWidth = width;
    (svgElement as any)._prevHeight = height;

    if (isFirstRender || activeDoppelgangerIdChanged || sizeChanged) {
      hasInitialFitRef.current = true;
      const fitTransform = getFitTransform();
      svgElement.call(zoom.transform, fitTransform);
    }

    // Standard D3 Links Join
    const linksJoin = linksG.selectAll<SVGLineElement, D3Link>("line.graph-link")
      .data(d3Links, (d) => d.id);

    linksJoin.exit().remove();

    const linksEnter = linksJoin.enter()
      .append("line")
      .attr("class", "graph-link")
      .attr("stroke", "var(--node-connection-color)")
      .attr("stroke-width", 2.0)
      .style("opacity", 0);

    const link = linksEnter.merge(linksJoin as any);

    // Apply link styles immediately to updated links — always gray at rest
    linksJoin
      .attr("stroke", "var(--node-connection-color)")
      .style("opacity", 0.45);

    // Fade in entering links as gray
    linksEnter.transition()
      .duration(600)
      .style("opacity", 0.45);

    // Standard D3 Nodes Join
    const nodesJoin = nodesG.selectAll<SVGGElement, D3Node>("g.node-group")
      .data(d3Nodes, (d) => d.id);

    nodesJoin.exit().remove();

    const nodesEnter = nodesJoin.enter()
      .append("g")
      .attr("class", "node-element node-group")
      .style("cursor", "pointer")
      .style("pointer-events", "auto");

    // Bind event handlers once during node creation
    nodesEnter.call(
      d3.drag<SVGGElement, D3Node>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
    );

    nodesEnter.on("click", function (event, d: any) {
      event.stopPropagation();
      event.preventDefault();
      console.log(`[CLICK TRIGGERED] Node ID: ${d.id}`);
      onSelectNodeRef.current(d.id);
    });

    nodesEnter.on("mouseover", function (event, d: any) {
      const gNode = d3.select(this);
      gNode.raise();
      gNode.select(".node-circle")
        .transition()
        .duration(150)
        .attr("stroke-width", () => {
          const lvl = getNodeLevel(d);
          const base = lvl === 1 ? 2.5 : (lvl === 2 ? 1.5 : 1.0);
          return base + 1;
        });

      svgElement.selectAll<SVGLineElement, D3Link>("line.graph-link")
        .filter((linkData: any) => 
          (typeof linkData.source === "object" ? linkData.source.id : linkData.source) === d.id ||
          (typeof linkData.target === "object" ? linkData.target.id : linkData.target) === d.id
        )
        .transition()
        .duration(150)
        .attr("stroke", (linkData) => getLinkColor(linkData))
        .attr("stroke-width", 2.5)
        .attr("opacity", 0.85);
    });

    nodesEnter.on("mouseout", function (event, d: any) {
      const gNode = d3.select(this);
      gNode.select(".node-circle")
        .transition()
        .duration(150)
        .attr("stroke-width", () => {
          const lvl = getNodeLevel(d);
          return lvl === 1 ? 2.5 : (lvl === 2 ? 1.5 : 1.0);
        });

      svgElement.selectAll<SVGLineElement, D3Link>("line.graph-link")
        .filter((linkData: any) => 
          (typeof linkData.source === "object" ? linkData.source.id : linkData.source) === d.id ||
          (typeof linkData.target === "object" ? linkData.target.id : linkData.target) === d.id
        )
        .transition()
        .duration(150)
        .attr("stroke", "var(--node-connection-color)")
        .attr("stroke-width", 2.0)
        .attr("opacity", 0.45);
    });

    // Append child visual components once on node creation
    nodesEnter.append("circle")
      .attr("class", "node-outer-ring")
      .attr("fill", "none")
      .style("pointer-events", "none");

    nodesEnter.append("circle")
      .attr("class", "node-circle")
      .style("pointer-events", "auto");

    nodesEnter.append("circle")
      .attr("class", "node-inner-core")
      .style("pointer-events", "auto");

    nodesEnter.append("text")
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
      .style("pointer-events", "none");

    nodesEnter.append("title");

    const node = nodesEnter.merge(nodesJoin as any);

    // Apply styles to all nodes (updated on every render)
    node.each(function (this: any, d: any) {
      const isSelected = d.id === selectedNodeId;
      const isActive = isLocalNode(d);
      const group = d3.select(this);

      const colors = getNodeColors(d);

      group.select(".node-outer-ring")
        .attr("r", getParentRadius(d) + 5)
        .style("display", isSelected ? "block" : "none")
        .attr("stroke", isActive ? "#2DD4BF" : "#52525b")
        .attr("stroke-width", 2)
        .attr("opacity", isActive ? 1.0 : 0.85);

      group.select(".node-circle")
        .attr("r", getParentRadius(d))
        .attr("fill", colors.fill)
        .attr("stroke", colors.stroke)
        .attr("stroke-width", () => {
          const lvl = getNodeLevel(d);
          return lvl === 1 ? 2.5 : (lvl === 2 ? 1.5 : 1.0);
        })
        .attr("stroke-dasharray", () => {
          const locked = isNodeLocked(d, unlockedTokens, parentGroups.parentOfNode, stagedNodes);
          return locked ? "4,4" : null;
        })
        .style("opacity", isActive ? 0.95 : 0.85);

      group.select(".node-inner-core")
        .attr("r", () => {
          const lvl = getNodeLevel(d);
          if (lvl === 1) return 8;
          if (lvl === 2) return 5;
          return 2.5;
        })
        .attr("fill", colors.stroke)
        .style("opacity", isActive ? 0.95 : 0.85);

      group.select(".node-text")
        .attr("dy", getParentRadius(d) + 24)
        .text(formatNodeLabel(d.label))
        .attr("fill", isActive ? "#F4F4F5" : "#71717a")
        .style("opacity", isActive ? 1.0 : 0.6);

      group.select("title")
        .text(`${formatNodeLabel(d.label)}: ${d.summary}`);

      // Apply fade transition safely
      const targetOpacity = (citedNodeIds && citedNodeIds.length > 0)
        ? (citedNodeIds.includes(d.id) ? 1.0 : 0.55)
        : 1.0;
      
      if (d.isNew) {
        group.style("opacity", 0)
          .transition()
          .duration(600)
          .ease(d3.easeCubicOut)
          .style("opacity", targetOpacity);

        group.select(".node-circle")
          .attr("transform", "scale(0.8)")
          .transition()
          .duration(600)
          .ease(d3.easeCubicOut)
          .attr("transform", "scale(1)");

        d.isNew = false;
      } else {
        group.style("opacity", targetOpacity);
      }
      group.style("pointer-events", "auto");
    });

    // Lock container visual layers once transition initiates
    if (workflowMode === 'v2') {
      const cc = d3.select("#canvas-container");
      if (!cc.empty()) {
        cc.style("opacity", 1).style("pointer-events", "auto");
      }
    }

    // Tick Handler mapping node coordinates to transform transforms
    simulation.on("tick", () => {
      if (workflowMode === 'v2') {
        const minX = 40;
        const maxX = Math.max(minX + 40, width - 40);
        const minY = 40;
        const maxY = Math.max(minY + 40, height - 40);

        d3Nodes.forEach((d: any) => {
          if (d.x !== undefined) {
            d.x = Math.max(minX, Math.min(maxX, d.x));
          }
          if (d.y !== undefined) {
            d.y = Math.max(minY, Math.min(maxY, d.y));
          }
        });
      }

      const getRadiusForLink = (nodeData: any) => {
        const base = getParentRadius(nodeData);
        return nodeData.id === selectedNodeIdRef.current ? base + 5 : base;
      };

      link
        .attr("x1", (d: any) => {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist === 0) return d.source.x;
          const r1 = getRadiusForLink(d.source);
          return d.source.x + (dx / dist) * r1;
        })
        .attr("y1", (d: any) => {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist === 0) return d.source.y;
          const r1 = getRadiusForLink(d.source);
          return d.source.y + (dy / dist) * r1;
        })
        .attr("x2", (d: any) => {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist === 0) return d.target.x;
          const r2 = getRadiusForLink(d.target);
          return d.target.x - (dx / dist) * r2;
        })
        .attr("y2", (d: any) => {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist === 0) return d.target.y;
          const r2 = getRadiusForLink(d.target);
          return d.target.y - (dy / dist) * r2;
        });

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Start simulation ticks in background
    simulation.alpha(0.3).restart();

    // Drag handlers
    function dragstarted(event: any, d: any) {
      if (!event.active && simulationRef.current) {
        simulationRef.current.alphaTarget(0.1).restart();
      }
      d.fx = d.x;
      d.fy = d.y;

      const currentPositions: { [nodeId: string]: { x: number; y: number } } = {};
      d3NodesRef.current.forEach(node => {
        if (node.x !== undefined && node.y !== undefined) {
          currentPositions[node.id] = { x: node.x, y: node.y };
        }
      });
      onStartDragging?.(currentPositions);
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    // Lock dragged node coords upon drag release
    function dragended(event: any, d: any) {
      if (!event.active && simulationRef.current) {
        simulationRef.current.alphaTarget(0);
      }
      d.fx = d.x;
      d.fy = d.y;

      const currentPositions: { [nodeId: string]: { x: number; y: number } } = {};
      d3NodesRef.current.forEach(node => {
        if (node.x !== undefined && node.y !== undefined) {
          currentPositions[node.id] = { x: node.x, y: node.y };
        }
      });
      onNodeDragged?.(currentPositions);
    }

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagedNodes, stagedEdges, dimensions, expandedParentId, parentGroups, resetTrigger, citedNodeIds, workflowMode, activeDoppelgangerId, unlockedTokens]);

  // Update node selection styles dynamically when selectedNodeId changes, without recreating simulation
  useEffect(() => {
    if (!svgRef.current) return;
    const svgElement = d3.select(svgRef.current);
    
    // Update outer ring display
    svgElement.selectAll<SVGGElement, D3Node>("g.node-group").each(function (d) {
      const isSelected = d.id === selectedNodeId;
      const group = d3.select(this);
      group.select(".node-outer-ring")
        .style("display", isSelected ? "block" : "none");
    });

    // Update link lines start/end offset points to account for the selected node's radius
    const getRadiusForLink = (nodeData: any) => {
      const base = getParentRadius(nodeData);
      return nodeData.id === selectedNodeId ? base + 5 : base;
    };

    svgElement.selectAll<SVGLineElement, D3Link>("line.graph-link").each(function (d: any) {
      const sNode = d.source;
      const tNode = d.target;
      if (sNode && tNode && typeof sNode === 'object' && typeof tNode === 'object') {
        const sNodeX = (sNode as any).x;
        const sNodeY = (sNode as any).y;
        const tNodeX = (tNode as any).x;
        const tNodeY = (tNode as any).y;
        
        if (sNodeX !== undefined && sNodeY !== undefined && tNodeX !== undefined && tNodeY !== undefined) {
          const dx = tNodeX - sNodeX;
          const dy = tNodeY - sNodeY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const r1 = getRadiusForLink(sNode);
            const r2 = getRadiusForLink(tNode);
            d3.select(this)
              .attr("x1", sNodeX + (dx / dist) * r1)
              .attr("y1", sNodeY + (dy / dist) * r1)
              .attr("x2", tNodeX - (dx / dist) * r2)
              .attr("y2", tNodeY - (dy / dist) * r2);
          }
        }
      }
    });
  }, [selectedNodeId]);

  return (
    <div
      ref={containerRef}
      id="d3-canvas-parent"
      className="w-full h-full relative overflow-hidden bg-[#0D0D0F] flex items-center justify-center min-h-[360px]"
    >
      <div className="absolute inset-0 opacity-[0.12] bg-[radial-gradient(#27272A_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      {(nodes.length === 0 && workflowMode !== 'v2') ? (
        <div className="text-zinc-600 font-mono text-xs flex flex-col items-center gap-2 z-10">
          <span>[ No Active Nodes Rendered ]</span>
          <span className="text-center px-4 max-w-xs text-zinc-500">
            Click &quot;Bootstrap Local Graph&quot; or write a journal entry to begin.
          </span>
        </div>
      ) : (
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="absolute inset-0 w-full h-full z-10 pointer-events-auto"
        />
      )}
    </div>
  );
}
