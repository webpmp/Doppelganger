import { useState, useEffect, useRef, FormEvent, useMemo, Fragment } from "react";
import { 
  Database, 
  Sparkles, 
  Send, 
  Shield, 
  Key, 
  Activity, 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight, 
  BookOpen, 
  User, 
  Lock, 
  Unlock, 
  HelpCircle,
  Hash,
  Mic,
  MicOff,
  X,
  Settings,
  Search,
  Users,
  Upload,
  Download,
  Save,
  Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ActiveNode, Memory, Edge, StateBlueprint, ProposalCard, ChatMessage } from "./types";
import KnowledgeGraphCanvas from "./components/KnowledgeGraphCanvas";

function DoppelgangerLogo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <img 
      src="/logo-doppelganger_nobg.png" 
      alt="Doppelgänger Logo" 
      className={`${className} object-contain rounded-lg`}
      referrerPolicy="no-referrer"
    />
  );
}

interface ScreensaverNode {
  id: string;
  parentId?: string;
  level: 'parent' | 'child' | 'grandchild' | 'leaflet';
  family: 'cyan' | 'red' | 'green' | 'rose' | 'violet';
  rBase: number;
  orbit: number;
  speed: number;
  angleOffset: number;
  opacity: number;
  triggerTime: number;
  baseX?: number;
  baseY?: number;
  wanderSpeedX?: number;
  wanderSpeedY?: number;
  isGray?: boolean;
}

function OnboardingBackground() {
  const [time, setTime] = useState(0);
  const [nodesState, setNodesState] = useState<ScreensaverNode[]>([]);

  // Color scheme definitions grouped by family and depth. Brightness decreases progressively as depth increases.
  const colorSchemes: Record<'cyan' | 'red' | 'green' | 'rose' | 'violet', {
    parent: { color: string; strokeColor: string };
    child: { color: string; strokeColor: string };
    grandchild: { color: string; strokeColor: string };
    leaflet: { color: string; strokeColor: string };
  }> = {
    cyan: {
      parent: { color: '#155e75', strokeColor: '#22d3ee' },
      child: { color: '#0e4152', strokeColor: '#0ea5e9' },
      grandchild: { color: '#082733', strokeColor: '#0284c7' },
      leaflet: { color: '#04131a', strokeColor: '#0369a1' }
    },
    red: {
      parent: { color: '#881337', strokeColor: '#f43f5e' },
      child: { color: '#5c0d25', strokeColor: '#db2777' },
      grandchild: { color: '#3d0919', strokeColor: '#be123c' },
      leaflet: { color: '#1f040c', strokeColor: '#9d174d' }
    },
    green: {
      parent: { color: '#064e3b', strokeColor: '#34d399' },
      child: { color: '#043528', strokeColor: '#10b981' },
      grandchild: { color: '#02241b', strokeColor: '#059669' },
      leaflet: { color: '#01120d', strokeColor: '#047857' }
    },
    rose: {
      parent: { color: '#4c0519', strokeColor: '#fda4af' },
      child: { color: '#881337', strokeColor: '#f43f5e' },
      grandchild: { color: '#5c0d25', strokeColor: '#db2777' },
      leaflet: { color: '#3d0919', strokeColor: '#e11d48' }
    },
    violet: {
      parent: { color: '#2e1065', strokeColor: '#ddd6fe' },
      child: { color: '#4c1d95', strokeColor: '#a78bfa' },
      grandchild: { color: '#3b0764', strokeColor: '#8b5cf6' },
      leaflet: { color: '#1e1b4b', strokeColor: '#6d28d9' }
    }
  };

  useEffect(() => {
    let animationFrameId: number;
    const start = Date.now();
    const update = () => {
      setTime((Date.now() - start) * 0.001);
      animationFrameId = requestAnimationFrame(update);
    };
    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Initialize randomized nodes once on mount so they differ each time the screensaver is launched
  useEffect(() => {
    const seed: ScreensaverNode[] = [];

    // Create 3 standard Level 1 nodes with nicely spread-out centers (Always colored)
    seed.push({
      id: 'p_1',
      level: 'parent',
      family: 'cyan',
      rBase: 28,
      orbit: 0,
      speed: 0,
      angleOffset: 0,
      opacity: 1,
      triggerTime: 0,
      baseX: 500 + (Math.random() * 80 - 40),
      baseY: 450 + (Math.random() * 80 - 40),
      wanderSpeedX: 0.12 + Math.random() * 0.08,
      wanderSpeedY: 0.10 + Math.random() * 0.08,
      isGray: false
    });

    seed.push({
      id: 'p_2',
      level: 'parent',
      family: 'red',
      rBase: 28,
      orbit: 0,
      speed: 0,
      angleOffset: 0,
      opacity: 1,
      triggerTime: 0,
      baseX: 220 + (Math.random() * 80 - 40),
      baseY: 650 + (Math.random() * 80 - 40),
      wanderSpeedX: -0.14 - Math.random() * 0.08,
      wanderSpeedY: 0.12 + Math.random() * 0.08,
      isGray: false
    });

    seed.push({
      id: 'p_3',
      level: 'parent',
      family: 'green',
      rBase: 28,
      orbit: 0,
      speed: 0,
      angleOffset: 0,
      opacity: 1,
      triggerTime: 0,
      baseX: 780 + (Math.random() * 80 - 40),
      baseY: 300 + (Math.random() * 80 - 40),
      wanderSpeedX: 0.15 + Math.random() * 0.08,
      wanderSpeedY: -0.13 - Math.random() * 0.08,
      isGray: false
    });

    // Seed children (Level 2) and grandchildren (Level 3) under the 3 main parent nodes
    const parentIds = ['p_1', 'p_2', 'p_3'];
    parentIds.forEach((pId) => {
      const parent = seed.find(n => n.id === pId)!;
      const numChildren = pId === 'p_1' ? 2 : 1; // Limit starting density
      for (let c = 0; c < numChildren; c++) {
        const cId = `c_${parent.id}_${c}`;
        // some child nodes can be generated as gray nodes connected to the colored parents
        const isChildGray = Math.random() < 0.35;
        seed.push({
          id: cId,
          parentId: parent.id,
          level: 'child',
          family: parent.family,
          rBase: 15,
          orbit: 135 + Math.random() * 40,
          speed: (0.08 + Math.random() * 0.12) * (Math.random() > 0.5 ? 1 : -1),
          angleOffset: (c * (2 * Math.PI / numChildren)) + Math.random() * 0.5,
          opacity: 1,
          triggerTime: 0,
          isGray: isChildGray
        });

        // Seed grandchildren for child
        const numGc = 1;
        for (let g = 0; g < numGc; g++) {
          const gcId = `gc_${cId}_${g}`;
          const isGcGray = isChildGray || (Math.random() < 0.35);
          seed.push({
            id: gcId,
            parentId: cId,
            level: 'grandchild',
            family: parent.family,
            rBase: 7.5,
            orbit: 40 + Math.random() * 15,
            speed: (0.2 + Math.random() * 0.2) * (Math.random() > 0.5 ? 1 : -1),
            angleOffset: (g * Math.PI) + Math.random(),
            opacity: 1,
            triggerTime: 0,
            isGray: isGcGray
          });
        }
      }
    });

    setNodesState(seed);
  }, []);

  // Set up periodic node growth checker (Max node limit = 20)
  useEffect(() => {
    if (nodesState.length === 0) return;

    const interval = setTimeout(() => {
      setNodesState(prev => {
        // Strict limit of 20 maximum nodes on screen
        if (prev.length >= 20) {
          return prev;
        }

        // Balance new nodes across existing parent nodes
        const parentNodes = prev.filter(n => n.level === 'parent');
        if (parentNodes.length === 0) return prev;

        // "It's okay to create new Level 1 nodes as time progresses."
        // Limit to 4 parents max to avoid clutter. 8% probability of spawning a parent.
        const shouldCreateParent = parentNodes.length < 4 && Math.random() < 0.08;

        if (shouldCreateParent) {
          const id = `p_${prev.length + 1}`;
          const availableFamilies: ('cyan' | 'red' | 'green' | 'rose' | 'violet')[] = ['cyan', 'red', 'green', 'rose', 'violet'];
          const family = availableFamilies[Math.floor(Math.random() * availableFamilies.length)];

          // Calculate nicely spaced coords
          let baseX = 150 + Math.random() * 700;
          let baseY = 150 + Math.random() * 700;

          for (let attempt = 0; attempt < 5; attempt++) {
            let tooClose = false;
            for (const other of parentNodes) {
              const otherX = other.baseX || 500;
              const otherY = other.baseY || 500;
              if (Math.hypot(baseX - otherX, baseY - otherY) < 220) {
                tooClose = true;
                break;
              }
            }
            if (!tooClose) break;
            baseX = 150 + Math.random() * 700;
            baseY = 150 + Math.random() * 700;
          }

          return [
            ...prev,
            {
              id,
              level: 'parent',
              family,
              rBase: 28,
              orbit: 0,
              speed: 0,
              angleOffset: 0,
              opacity: 0.1,
              triggerTime: time,
              baseX,
              baseY,
              wanderSpeedX: (0.1 + Math.random() * 0.1) * (Math.random() > 0.5 ? 1 : -1),
              wanderSpeedY: (0.1 + Math.random() * 0.1) * (Math.random() > 0.5 ? 1 : -1),
              isGray: false
            }
          ];
        }

        // Create secondary/tertiary node: Child (Level 2), Grandchild (Level 3), or Leaflet (Level 4)
        const decisionVal = Math.random();
        const isNewNodeGray = Math.random() < 0.40;

        if (decisionVal < 0.35) {
          // --- ADD LEVEL 2 CHILD ---
          let targetParent = parentNodes[0];
          let minChildrenCount = Infinity;

          parentNodes.forEach(p => {
            const childrenCount = prev.filter(n => n.parentId === p.id && n.level === 'child').length;
            if (childrenCount < minChildrenCount) {
              minChildrenCount = childrenCount;
              targetParent = p;
            }
          });

          const id = `c_new_${prev.length}`;
          return [
            ...prev,
            {
              id,
              parentId: targetParent.id,
              level: 'child',
              family: targetParent.family,
              rBase: 15,
              orbit: 135 + Math.random() * 45,
              speed: (0.07 + Math.random() * 0.1) * (Math.random() > 0.5 ? 1 : -1),
              angleOffset: Math.random() * 2 * Math.PI,
              opacity: 0.1,
              triggerTime: time,
              isGray: isNewNodeGray
            }
          ];
        } else if (decisionVal < 0.70) {
          // --- ADD LEVEL 3 GRANDCHILD ---
          const children = prev.filter(n => n.level === 'child');
          if (children.length === 0) return prev;

          let targetChild = children[0];
          let minGcCount = Infinity;

          children.forEach(c => {
            const gcCount = prev.filter(n => n.parentId === c.id && n.level === 'grandchild').length;
            if (gcCount < minGcCount) {
              minGcCount = gcCount;
              targetChild = c;
            }
          });

          const id = `gc_new_${prev.length}`;
          return [
            ...prev,
            {
              id,
              parentId: targetChild.id,
              level: 'grandchild',
              family: targetChild.family,
              rBase: 7.5,
              orbit: 40 + Math.random() * 15,
              speed: (0.2 + Math.random() * 0.2) * (Math.random() > 0.5 ? 1 : -1),
              angleOffset: Math.random() * 2 * Math.PI,
              opacity: 0.1,
              triggerTime: time,
              isGray: isNewNodeGray || targetChild.isGray
            }
          ];
        } else {
          // --- ADD LEVEL 4 LEAFLET ---
          const grandchildren = prev.filter(n => n.level === 'grandchild');
          if (grandchildren.length === 0) return prev;

          let targetGc = grandchildren[0];
          let minLeafCount = Infinity;

          grandchildren.forEach(gc => {
            const leafCount = prev.filter(n => n.parentId === gc.id && n.level === 'leaflet').length;
            if (leafCount < minLeafCount) {
              minLeafCount = leafCount;
              targetGc = gc;
            }
          });

          const id = `lf_new_${prev.length}`;
          return [
            ...prev,
            {
              id,
              parentId: targetGc.id,
              level: 'leaflet',
              family: targetGc.family,
              rBase: 4.5,
              orbit: 20 + Math.random() * 10,
              speed: (0.35 + Math.random() * 0.3) * (Math.random() > 0.5 ? 1 : -1),
              angleOffset: Math.random() * 2 * Math.PI,
              opacity: 0.1,
              triggerTime: time,
              isGray: isNewNodeGray || targetGc.isGray
            }
          ];
        }
      });
    }, 1500);

    return () => clearTimeout(interval);
  }, [nodesState.length, time]);

  // Build sequential nodes dictionary with calculated positions
  const nodeMap: { [id: string]: { id: string; x: number; y: number; r: number; color: string; strokeColor: string; level: string; parentId?: string; opacity: number; family: string; isGray: boolean } } = {};

  // First process parents
  nodesState.forEach(node => {
    if (node.level === 'parent') {
      const wanderX = Math.sin(time * (node.wanderSpeedX || 0.15)) * 35;
      const wanderY = Math.cos(time * (node.wanderSpeedY || 0.12)) * 35;
      const x = (node.baseX || 500) + wanderX;
      const y = (node.baseY || 500) + wanderY;

      // Count dynamic visible descendants of this parent
      const visibleDescendantsCount = nodesState.filter(desc => {
        if (desc.id === node.id) return false;
        // Trace ancestry
        let pId = desc.parentId;
        while (pId) {
          if (pId === node.id) return true;
          const parentObj = nodesState.find(n => n.id === pId);
          pId = parentObj?.parentId;
        }
        return false;
      }).length;

      // "As new Level 2 and Level 3 nodes are added, the connected Level 1 node should get bigger."
      // Start with base 28, add 1.8px for every added node in its cluster!
      const dynamicR = node.rBase + (visibleDescendantsCount * 1.8);

      const opacity = Math.min(1, Math.max(0, (time - node.triggerTime) * 0.67));

      nodeMap[node.id] = {
        id: node.id,
        x,
        y,
        r: dynamicR,
        color: colorSchemes[node.family]?.parent.color || colorSchemes.cyan.parent.color,
        strokeColor: colorSchemes[node.family]?.parent.strokeColor || colorSchemes.cyan.parent.strokeColor,
        level: 'parent',
        family: node.family,
        opacity,
        isGray: false
      };
    }
  });

  // Then process child/grandchild/leaflet levels sequentially
  const levels: ('child' | 'grandchild' | 'leaflet')[] = ['child', 'grandchild', 'leaflet'];
  levels.forEach(lvl => {
    nodesState.forEach(node => {
      if (node.level === lvl) {
        const parentCalculated = nodeMap[node.parentId!];
        if (parentCalculated) {
          const angle = time * node.speed + node.angleOffset;
          // orbit calculation
          const x = parentCalculated.x + Math.cos(angle) * node.orbit;
          const y = parentCalculated.y + Math.sin(angle) * node.orbit;

          const scheme = colorSchemes[node.family] || colorSchemes.cyan;
          let color = '#fff';
          let strokeColor = '#fff';

          if (node.isGray) {
            color = '#18181b';
            strokeColor = '#52525b';
          } else {
            if (lvl === 'child') {
              color = scheme.child.color;
              strokeColor = scheme.child.strokeColor;
            } else if (lvl === 'grandchild') {
              color = scheme.grandchild.color;
              strokeColor = scheme.grandchild.strokeColor;
            } else {
              color = scheme.leaflet.color;
              strokeColor = scheme.leaflet.strokeColor;
            }
          }

          // Capped opacity for gray nodes to match background/transparency design
          const opacity = node.isGray 
            ? Math.min(0.45, Math.max(0, (time - node.triggerTime) * 0.45))
            : Math.min(1, Math.max(0, (time - node.triggerTime) * 0.67));

          nodeMap[node.id] = {
            id: node.id,
            parentId: node.parentId,
            x,
            y,
            r: node.rBase,
            color,
            strokeColor,
            level: lvl,
            family: node.family,
            opacity,
            isGray: !!node.isGray
          };
        }
      }
    });
  });

  const allNodes = Object.values(nodeMap);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none opacity-55 animate-fadeIn">
      <svg className="w-full h-full" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="glow-cyan" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glow-red" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glow-green" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glow-rose" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fda4af" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glow-violet" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#c084fc" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          <filter id="glow-effect" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ambient background glows */}
        {allNodes.filter(n => n.level === 'parent').map(parent => (
          <circle
            key={`glow-${parent.id}`}
            cx={parent.x}
            cy={parent.y}
            r={parent.id === 'p_a' || parent.id === 'p_1' ? "350" : "250"}
            fill={`url(#glow-${parent.family})`}
            opacity={parent.opacity}
          />
        ))}

        {/* Connection lines (links) strictly internal to the background node families */}
        {allNodes.map((node) => {
          if (!node.parentId) return null;
          const parent = nodeMap[node.parentId];
          if (!parent) return null;

          const lineOpacity = Math.min(node.opacity, parent.opacity) * 0.45;
          if (lineOpacity <= 0) return null;

          return (
            <line
              key={`line-${node.id}`}
              x1={parent.x}
              y1={parent.y}
              x2={node.x}
              y2={node.y}
              stroke={node.strokeColor}
              strokeWidth="1.2"
              strokeDasharray="3,3"
              opacity={lineOpacity}
            />
          );
        })}

        {/* Nodes grouped by levels (Parent, Child, Grandchild, Leaflet) */}
        {allNodes.map((node) => {
          if (node.opacity <= 0) return null;

          const isRed = node.strokeColor === '#f43f5e' || node.color === '#881337';

          if (node.level === 'parent') {
            return (
              <g key={node.id} filter="url(#glow-effect)" opacity={node.opacity}>
                <circle cx={node.x} cy={node.y} r={node.r * 1.25} fill="none" stroke={node.strokeColor} strokeWidth="1" strokeDasharray={isRed ? "5,5" : undefined} opacity={isRed ? 0.4 : 0.25} />
                <circle cx={node.x} cy={node.y} r={node.r} fill={node.color} stroke={node.strokeColor} strokeWidth="2.5" strokeDasharray={isRed ? "4,4" : undefined} />
                <circle cx={node.x} cy={node.y} r="8" fill={node.strokeColor} />
              </g>
            );
          } else if (node.level === 'child') {
            return (
              <g key={node.id} filter="url(#glow-effect)" opacity={node.opacity}>
                <circle cx={node.x} cy={node.y} r={node.r} fill={node.color} stroke={node.strokeColor} strokeWidth="1.5" strokeDasharray={isRed ? "3,3" : undefined} />
                <circle cx={node.x} cy={node.y} r={5} fill={node.strokeColor} />
              </g>
            );
          } else if (node.level === 'grandchild') {
            return (
              <g key={node.id} opacity={node.opacity}>
                <circle cx={node.x} cy={node.y} r={node.r} fill={node.color} stroke={node.strokeColor} strokeWidth="1.0" strokeDasharray={isRed ? "2,2" : undefined} />
                <circle cx={node.x} cy={node.y} r={2.5} fill={node.strokeColor} />
              </g>
            );
          } else {
            // Level 4/5 Leaflets
            return (
              <g key={node.id} opacity={node.opacity}>
                <circle cx={node.x} cy={node.y} r={node.r} fill={node.color} stroke={node.strokeColor} strokeWidth="0.75" strokeDasharray={isRed ? "2,2" : undefined} />
                <circle cx={node.x} cy={node.y} r={1.5} fill={node.strokeColor} />
              </g>
            );
          }
        })}
      </svg>
    </div>
  );
}

// The default mock state to bypass any database storage
const DEFAULT_MOCK_STATE: StateBlueprint = {
  activeNodes: [
    {
      id: "node-1.0",
      label: "1.0 Mobile App Redesign",
      summary: "Top-level parent project tracking macro mobile design deliverables.",
      node_state: "active",
      visibility_status: "public",
      access_key_hash: null,
      accessKeyHash: null,
      isIsolated: false,
      weight: 3.0
    },
    {
      id: "node-1.1",
      label: "1.1 Discovery Phase",
      summary: "Tracking cross-functional dependencies and baseline user metrics.",
      node_state: "active",
      visibility_status: "public",
      access_key_hash: null,
      accessKeyHash: null,
      isIsolated: false,
      weight: 2.0
    },
    {
      id: "node-1.11",
      label: "1.11 Product Design Doc",
      summary: "Official PDD link anchoring platform layout constraints.",
      node_state: "active",
      visibility_status: "public",
      access_key_hash: null,
      accessKeyHash: null,
      isIsolated: false,
      weight: 1.0
    },
    {
      id: "node-1.12",
      label: "1.12 Competitive Analysis",
      summary: "Research audit tracking global interaction design patterns.",
      node_state: "active",
      visibility_status: "public",
      access_key_hash: null,
      accessKeyHash: null,
      isIsolated: false,
      weight: 1.0
    },
    {
      id: "node-1.13",
      label: "1.13 Rapid Concepting Loop",
      summary: "Designers generating low-fidelity spatial variations.",
      node_state: "active",
      visibility_status: "public",
      access_key_hash: null,
      accessKeyHash: null,
      isIsolated: false,
      weight: 1.0
    },
    {
      id: "node-1.2",
      label: "1.2 Project Timeline",
      summary: "Kickoff parameters and bi-weekly milestone check-ins.",
      node_state: "active",
      visibility_status: "public",
      access_key_hash: null,
      accessKeyHash: null,
      isIsolated: false,
      weight: 2.0
    },
    {
      id: "node-1.3",
      label: "1.3 Team Resourcing",
      summary: "Design matrix allocations for product designers and researchers.",
      node_state: "active",
      visibility_status: "public",
      access_key_hash: null,
      accessKeyHash: null,
      isIsolated: false,
      weight: 2.0
    },
    {
      id: "node-2.0",
      label: "2.0 Kinetic Type Prototype V2",
      summary: "Top-level parent project for the motion typography study.",
      node_state: "active",
      visibility_status: "public",
      access_key_hash: null,
      accessKeyHash: null,
      isIsolated: false,
      weight: 3.0
    },
    {
      id: "node-2.1",
      label: "2.1 Vendor Procurement",
      summary: "Managing external motion design studio contract routing.",
      node_state: "active",
      visibility_status: "public",
      access_key_hash: null,
      accessKeyHash: null,
      isIsolated: false,
      weight: 2.0
    },
    {
      id: "node-2.11",
      label: "2.11 Purchase Order #1",
      summary: "Finance approved PO securing external animation resources.",
      node_state: "active",
      visibility_status: "public",
      access_key_hash: null,
      accessKeyHash: null,
      isIsolated: false,
      weight: 1.0
    },
    {
      id: "node-3.0",
      label: "3.0 Design Sprints Planning",
      summary: "Coordinating workshop schedules and Miro collaboration boards.",
      node_state: "active",
      visibility_status: "public",
      access_key_hash: null,
      accessKeyHash: null,
      isIsolated: false,
      weight: 3.0
    },
    {
      id: "node-4.0",
      label: "4.0 Branding Update",
      summary: "Driving system alignment across design tokens and typography scales.",
      node_state: "active",
      visibility_status: "public",
      access_key_hash: null,
      accessKeyHash: null,
      isIsolated: false,
      weight: 3.0
    },
    {
      id: "node-5.0",
      label: "5.0 Secret Project Cobalt",
      summary: "In-device low-latency AI agent client running local models securely. Requires code key COBALT-ACCESS to unlock and view.",
      node_state: "active",
      visibility_status: "isolated_passphrase",
      access_key_hash: "COBALT-ACCESS",
      accessKeyHash: "COBALT-ACCESS",
      isIsolated: true,
      weight: 3.0
    }
  ],
  memories: [
    {
      node_id: "node-1.0",
      content: "Main digital strategy focusing on improving layout consistency across viewport sizes.",
      source_origin: "Journal_v1"
    },
    {
      node_id: "node-1.1",
      content: "Baseline study on layout performance target <150ms rendering benchmarks.",
      source_origin: "Journal_v1"
    },
    {
      node_id: "node-1.11",
      content: "PDD maps layout limits, Inter typefaces details, and atomic spacing rules.",
      source_origin: "Journal_v1"
    },
    {
      node_id: "node-1.12",
      content: "A competitive product evaluation confirms that multi-sidebar screen density improves productivity.",
      source_origin: "Journal_v1"
    },
    {
      node_id: "node-1.13",
      content: "Exploratory design sketches generated showing low-fidelity spatial variations.",
      source_origin: "Journal_v1"
    },
    {
      node_id: "node-1.2",
      content: "Milestone schedule sets alpha test for week four with bi-weekly updates.",
      source_origin: "Journal_v2"
    },
    {
      node_id: "node-1.3",
      content: "Assigning 3 full-time product designers and 2 UX researchers to the task.",
      source_origin: "Journal_v2"
    },
    {
      node_id: "node-2.0",
      content: "Exploratory typographic study assessing font scales on smooth animated displays.",
      source_origin: "Journal_v3"
    },
    {
      node_id: "node-2.1",
      content: "Vendor procurement workflow initiated with motion design partners.",
      source_origin: "Journal_v3"
    },
    {
      node_id: "node-2.11",
      content: "Finance approved Purchase Order #1 to allocate animation consulting funds.",
      source_origin: "Journal_v3"
    },
    {
      node_id: "node-3.0",
      content: "Workshop session started on Miro to brainstorm brand alignment options.",
      source_origin: "Journal_v4"
    },
    {
      node_id: "node-4.0",
      content: "Synchronized style token files across product elements to match Inter typography.",
      source_origin: "Journal_v4"
    },
    {
      node_id: "node-5.0",
      content: "Stealth Project: Launching 'Project Cobalt' to make our AI helper run super fast directly on user devices without sending data to servers. This project requires code key COBALT-ACCESS to unlock and view. Let's keep data secure.",
      source_origin: "Journal_v1"
    }
  ],
  edges: [
    { source: "node-1.1", target: "node-1.0", relation: "child_of" },
    { source: "node-1.11", target: "node-1.1", relation: "grandchild_of" },
    { source: "node-1.12", target: "node-1.1", relation: "grandchild_of" },
    { source: "node-1.13", target: "node-1.1", relation: "grandchild_of" },
    { source: "node-1.2", target: "node-1.0", relation: "child_of" },
    { source: "node-1.3", target: "node-1.0", relation: "child_of" },
    { source: "node-2.1", target: "node-2.0", relation: "child_of" },
    { source: "node-2.11", target: "node-2.1", relation: "grandchild_of" }
  ],
  owner: {
    name: "Chris Adkins",
    title: "Principal Design Program Manager",
    email: "webpmp@gmail.com",
    photoUrl: "/image-chris-adkins.png"
  }
};

const ALEX_MOCK_STATE: StateBlueprint = {
  activeNodes: [
    {
      id: "node-a10",
      label: "1.0 Platform Developer Experience",
      summary: "Strategic plan to minimize package compile and build times for full-stack clusters.",
      node_state: "active",
      visibility_status: "public",
      access_key_hash: null,
      accessKeyHash: null,
      isIsolated: false,
      weight: 3.0
    },
    {
      id: "node-a11",
      label: "1.1 CI/CD Cluster Runners",
      summary: "Upgrading to highly optimized on-demand container runner nodes.",
      node_state: "active",
      visibility_status: "public",
      access_key_hash: null,
      accessKeyHash: null,
      isIsolated: false,
      weight: 2.0
    },
    {
      id: "node-a12",
      label: "1.2 Cached Layers Analytics",
      summary: "A study showing reduced cold-start container pull times by caching internal base layers.",
      node_state: "active",
      visibility_status: "public",
      access_key_hash: null,
      accessKeyHash: null,
      isIsolated: false,
      weight: 1.0
    },
    {
      id: "node-a20",
      label: "2.0 Federated GraphQL Hub",
      summary: "Developing a single gateway to stitch split query microservices cleanly.",
      node_state: "active",
      visibility_status: "public",
      access_key_hash: null,
      accessKeyHash: null,
      isIsolated: false,
      weight: 3.0
    },
    {
      id: "node-a21",
      label: "2.1 Schema Type Stitching",
      summary: "Consolidating dynamic types across microservice schemas automatically.",
      node_state: "active",
      visibility_status: "public",
      access_key_hash: null,
      accessKeyHash: null,
      isIsolated: false,
      weight: 1.5
    },
    {
      id: "node-a30",
      label: "3.0 Stealth Project Cobalt Security",
      summary: "Zero-trust encrypted database client and credential service for inter-node RPC. Requires code key COBALT-ACCESS to unlock and view.",
      node_state: "active",
      visibility_status: "isolated_passphrase",
      access_key_hash: "COBALT-ACCESS",
      accessKeyHash: "COBALT-ACCESS",
      isIsolated: true,
      weight: 3.0
    }
  ],
  memories: [
    {
      node_id: "node-a10",
      content: "Platform developer experience strategy aiming to lower production CI builds below 120s.",
      source_origin: "Journal_v1"
    },
    {
      node_id: "node-a11",
      content: "Migrate traditional runner systems to on-demand serverless containers with automated pooling.",
      source_origin: "Journal_v2"
    },
    {
      node_id: "node-a12",
      content: "Tested baseline container runtimes indicating a major bottleneck in remote layer downloads.",
      source_origin: "Journal_v2"
    },
    {
      node_id: "node-a20",
      content: "Brainstorming standard API schemas across product groups (Identity, Search, Logs).",
      source_origin: "Journal_v3"
    },
    {
      node_id: "node-a21",
      content: "Drafted prototype auto-packer tool that parses schema files and triggers a unified build.",
      source_origin: "Journal_v3"
    },
    {
      node_id: "node-a30",
      content: "Stealth Project: Launching 'Project Cobalt' to make our AI helper run super fast directly on user devices without sending data to servers. This project requires code key COBALT-ACCESS to unlock and view. Let's keep data secure.",
      source_origin: "Journal_Entry"
    }
  ],
  edges: [
    { source: "node-a11", target: "node-a10", relation: "child_of" },
    { source: "node-a12", target: "node-a11", relation: "grandchild_of" },
    { source: "node-a21", target: "node-a20", relation: "child_of" }
  ],
  owner: {
    name: "Alex Morgan",
    title: "Staff Engineer, Platform",
    email: "alex.morgan@gmail.com",
    photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
  }
};

const JORDAN_MOCK_STATE: StateBlueprint = {
  activeNodes: [
    {
      id: "node-j10",
      label: "1.0 Design Sprints Planning",
      summary: "Coordinating cross-team workshop structures, scheduling resources, and preparing board templates.",
      node_state: "active",
      visibility_status: "public",
      access_key_hash: null,
      accessKeyHash: null,
      isIsolated: false,
      weight: 3.0
    },
    {
      id: "node-j11",
      label: "1.1 Workshop Design Exercises",
      summary: "Formulating design challenge prompts to align branding across teams.",
      node_state: "active",
      visibility_status: "public",
      access_key_hash: null,
      accessKeyHash: null,
      isIsolated: false,
      weight: 2.0
    },
    {
      id: "node-j20",
      label: "2.0 Branding Update Guidelines",
      summary: "Enforcing typography and token sync protocols throughout sprint cycles.",
      node_state: "active",
      visibility_status: "public",
      access_key_hash: null,
      accessKeyHash: null,
      isIsolated: false,
      weight: 3.0
    },
    {
      id: "node-j30",
      label: "3.0 Stealth Project Aegis Merger",
      summary: "Due diligence study and structural review of operational integrations. Requires code key AEGIS-DECODE to unlock and view.",
      node_state: "active",
      visibility_status: "isolated_passphrase",
      access_key_hash: "AEGIS-DECODE",
      accessKeyHash: "AEGIS-DECODE",
      isIsolated: true,
      weight: 3.0
    }
  ],
  memories: [
    {
      node_id: "node-j10",
      content: "Aligning Design Operations sprint tempos across 4 core departments.",
      source_origin: "Journal_v1"
    },
    {
      node_id: "node-j11",
      content: "Created workshop schedules and structured collaborative canvas templates.",
      source_origin: "Journal_v1"
    },
    {
      node_id: "node-j20",
      content: "Verified typographic system guidelines to keep layout scales cohesive across viewports.",
      source_origin: "Journal_v2"
    },
    {
      node_id: "node-j30",
      content: "All systems are loaded! We added 3 sample projects to the map. Two are public, and one is hidden ('Project Aegis'). Try typing 'AEGIS-DECODE' in the passcode entry box to unlock the hidden project!",
      source_origin: "Journal_Entry"
    }
  ],
  edges: [
    { source: "node-j11", target: "node-j10", relation: "child_of" }
  ],
  owner: {
    name: "Jordan Lee",
    title: "Product Operations Lead",
    email: "jordan.lee@gmail.com",
    photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
  }
};

const PROFILES = [
  {
    name: "Chris Adkins",
    handle: "@chris.adkins",
    title: "Principal Design Program Manager",
    email: "webpmp@gmail.com",
    photoUrl: "/image-chris-adkins.png",
    initialState: DEFAULT_MOCK_STATE
  },
  {
    name: "Alex Morgan",
    handle: "@alex.morgan",
    title: "Staff Engineer, Platform",
    email: "alex.morgan@gmail.com",
    photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    initialState: ALEX_MOCK_STATE
  },
  {
    name: "Jordan Lee",
    handle: "@jordan.lee",
    title: "Product Operations Lead",
    email: "jordan.lee@gmail.com",
    photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    initialState: JORDAN_MOCK_STATE
  }
];

const SHARED_NODES_DATA: Record<string, { nearby: any[]; federated: any[] }> = {
  "@chris.adkins": {
    nearby: [
      {
        id: "shared-alex-api",
        label: "API Migration",
        summary: "Platform API upgrade and query optimization by Alex Morgan.",
        node_state: "active",
        visibility_status: "public",
        access_key_hash: null,
        accessKeyHash: null,
        isIsolated: false,
        weight: 2.0,
        isShared: true,
        ownerName: "Alex Morgan",
        ownerTitle: "Senior Engineer, Mobile Platform",
        ownerHandle: "@alex.morgan",
        connectedProject: "Mobile App Redesign",
        relationshipSummary: "API endpoints synchronization for design parity with local Mobile App Redesign.",
        relatedAreas: ["API Migration", "Release Readiness", "Offline Sync"],
        parentId: "node-1.0"
      },
      {
        id: "shared-alex-sync",
        label: "Offline Sync",
        summary: "Local state sqlite and network buffering engine by Alex Morgan.",
        node_state: "active",
        visibility_status: "public",
        access_key_hash: null,
        accessKeyHash: null,
        isIsolated: false,
        weight: 1.5,
        isShared: true,
        ownerName: "Alex Morgan",
        ownerTitle: "Senior Engineer, Mobile Platform",
        ownerHandle: "@alex.morgan",
        connectedProject: "Mobile App Redesign",
        relationshipSummary: "Data persistence design constraints and offline cache policy.",
        relatedAreas: ["API Migration", "Release Readiness", "Offline Sync"],
        parentId: "node-1.1"
      },
      {
        id: "shared-jordan-ops",
        label: "Design Sprints Ops",
        summary: "Coordinating sprint structures across core departments by Jordan Lee.",
        node_state: "active",
        visibility_status: "public",
        access_key_hash: null,
        accessKeyHash: null,
        isIsolated: false,
        weight: 2.0,
        isShared: true,
        ownerName: "Jordan Lee",
        ownerTitle: "Product Operations Lead",
        ownerHandle: "@jordan.lee",
        connectedProject: "Design Sprints Planning",
        relationshipSummary: "Cross-department team scheduling and canvas templates to sync with local design sprints.",
        relatedAreas: ["Operations Temp", "Sprint Boards", "Branding Guidelines"],
        parentId: "node-3.0"
      }
    ],
    federated: [
      {
        id: "shared-alex-release",
        label: "Release Readiness",
        summary: "Continuous delivery compilation audits and runner pools by Alex Morgan.",
        node_state: "active",
        visibility_status: "public",
        access_key_hash: null,
        accessKeyHash: null,
        isIsolated: false,
        weight: 1.5,
        isShared: true,
        ownerName: "Alex Morgan",
        ownerTitle: "Senior Engineer, Mobile Platform",
        ownerHandle: "@alex.morgan",
        connectedProject: "Mobile App Redesign",
        relationshipSummary: "Validating layout load speed on remote CI/CD device simulators.",
        relatedAreas: ["API Migration", "Release Readiness", "Offline Sync"],
        parentId: "node-1.0"
      },
      {
        id: "shared-jordan-brand",
        label: "Typography Enforcement",
        summary: "Automated design system typography audits of team assets by Jordan Lee.",
        node_state: "active",
        visibility_status: "public",
        access_key_hash: null,
        accessKeyHash: null,
        isIsolated: false,
        weight: 1.5,
        isShared: true,
        ownerName: "Jordan Lee",
        ownerTitle: "Product Operations Lead",
        ownerHandle: "@jordan.lee",
        connectedProject: "Branding Update Guidelines",
        relationshipSummary: "Validating typography and token system compliance during active sprints.",
        relatedAreas: ["Branding Guidelines", "Design Sprints Ops"],
        parentId: "node-4.0"
      }
    ]
  },
  "@alex.morgan": {
    nearby: [
      {
        id: "shared-chris-redesign",
        label: "Mobile App Redesign",
        summary: "Macro digital design strategy and spatial concept iterations by Chris Adkins.",
        node_state: "active",
        visibility_status: "public",
        access_key_hash: null,
        accessKeyHash: null,
        isIsolated: false,
        weight: 2.0,
        isShared: true,
        ownerName: "Chris Adkins",
        ownerTitle: "Principal Design Program Manager",
        ownerHandle: "@chris.adkins",
        connectedProject: "Platform Developer Experience",
        relationshipSummary: "Aligning developer platforms with user-facing viewport constraints.",
        relatedAreas: ["Mobile App Redesign", "Kinetic Type Prototype V2"],
        parentId: "node-a10"
      }
    ],
    federated: [
      {
        id: "shared-jordan-ops-alex",
        label: "Design Sprints",
        summary: "Ensuring developer sandboxes are ready for prototyping workshops by Jordan Lee.",
        node_state: "active",
        visibility_status: "public",
        access_key_hash: null,
        accessKeyHash: null,
        isIsolated: false,
        weight: 1.5,
        isShared: true,
        ownerName: "Jordan Lee",
        ownerTitle: "Product Operations Lead",
        ownerHandle: "@jordan.lee",
        connectedProject: "Platform Developer Experience",
        relationshipSummary: "Workspace sandbox prototyping and workbook assets logic.",
        relatedAreas: ["Design Sprints Ops", "Branding Guidelines"],
        parentId: "node-a11"
      }
    ]
  },
  "@jordan.lee": {
    nearby: [
      {
        id: "shared-chris-sprints",
        label: "Design Sprints Planning",
        summary: "Coordinating project milestones and workbook formats by Chris Adkins.",
        node_state: "active",
        visibility_status: "public",
        access_key_hash: null,
        accessKeyHash: null,
        isIsolated: false,
        weight: 2.0,
        isShared: true,
        ownerName: "Chris Adkins",
        ownerTitle: "Principal Design Program Manager",
        ownerHandle: "@chris.adkins",
        connectedProject: "Design Sprints Planning",
        relationshipSummary: "Mapping core milestone deliverables for ops workshop alignment.",
        relatedAreas: ["Design Sprints Planning", "Branding Update"],
        parentId: "node-j10"
      }
    ],
    federated: [
      {
        id: "shared-alex-stitching",
        label: "Schema Stitching",
        summary: "Dynamic schema compilation across microservices by Alex Morgan.",
        node_state: "active",
        visibility_status: "public",
        access_key_hash: null,
        accessKeyHash: null,
        isIsolated: false,
        weight: 1.5,
        isShared: true,
        ownerName: "Alex Morgan",
        ownerTitle: "Senior Engineer, Mobile Platform",
        ownerHandle: "@alex.morgan",
        connectedProject: "Branding Update Guidelines",
        relationshipSummary: "Data schemas for syncing tokens across client runtimes.",
        relatedAreas: ["Schema Stitching", "Federated GraphQL"],
        parentId: "node-j20"
      }
    ]
  }
};

const getMemoryDate = (source: string) => {
  if (!source) return "June 7, 2026";
  const norm = source.trim().toLowerCase();
  if (norm === "journal_v1") return "May 10, 2026";
  if (norm === "journal_v2") return "May 18, 2026";
  if (norm === "journal_v3") return "May 25, 2026";
  if (norm === "journal_v4") return "June 2, 2026";
  if (norm === "journal_entry") return "June 7, 2026";

  // Check if it is already an ISO string or a date-like layout
  try {
    const parsed = new Date(source);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
  } catch (e) {
    // ignore
  }
  return source;
};

export interface NodeSearchTags {
  id: string;
  humanTitle: string;
  canonicalTag: string;
  compactTag: string;
  semanticAliases: string[];
}

export function getNodeSearchTags(node: { id: string; label: string; summary: string }): NodeSearchTags {
  const rawLabel = node.label || "";
  // Clean serial prefix (e.g., 3.0, 1.11, 3.1)
  const cleanedTitle = rawLabel.replace(/^\d+(\.\d+)?\s*/, "").trim();
  
  // Canonical tag: convert to kebab-case with hashtag
  const canonicalTag = "#" + cleanedTitle.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // Compact tag: alphanumeric lowercase with hashtag
  const compactTag = "#" + cleanedTitle.toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  // Semantic aliases
  const words = (cleanedTitle + " " + (node.summary || ""))
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !["with", "this", "that", "from", "your", "under", "over", "requires", "link", "official", "tracking", "phase", "macro", "micro", "cross", "phase"].includes(w));
  
  const semanticAliasesSet = new Set<string>();
  words.forEach(w => {
    semanticAliasesSet.add("#" + w);
  });

  // Explicit highly specific custom aliases for key nodes
  if (rawLabel.toLowerCase().includes("sprint")) {
    semanticAliasesSet.add("#designsprint");
    semanticAliasesSet.add("#sprintplanning");
    semanticAliasesSet.add("#miroworkshops");
    semanticAliasesSet.add("#brandworkshops");
  }
  if (rawLabel.toLowerCase().includes("cobalt")) {
    semanticAliasesSet.add("#cobaltsearch");
    semanticAliasesSet.add("#stealthtech");
    semanticAliasesSet.add("#localmodels");
  }
  if (rawLabel.toLowerCase().includes("redesign") || rawLabel.toLowerCase().includes("mobile")) {
    semanticAliasesSet.add("#mobileux");
    semanticAliasesSet.add("#redesigndoc");
    semanticAliasesSet.add("#interact");
  }
  if (rawLabel.toLowerCase().includes("kinetic") || rawLabel.toLowerCase().includes("type")) {
    semanticAliasesSet.add("#motiontypography");
    semanticAliasesSet.add("#fontstudy");
    semanticAliasesSet.add("#typecraft");
  }

  // Remove duplicates of canonical or compact tags
  semanticAliasesSet.delete(canonicalTag);
  semanticAliasesSet.delete(compactTag);

  return {
    id: node.id,
    humanTitle: rawLabel,
    canonicalTag,
    compactTag,
    semanticAliases: Array.from(semanticAliasesSet)
  };
}

export function matchNodeSearch(node: { id: string; label: string; summary: string }, query: string): { matches: boolean; score: number; matchedType: string } {
  const normQuery = query.toLowerCase().trim();
  if (!normQuery) return { matches: false, score: 0, matchedType: "" };

  const tags = getNodeSearchTags(node);
  
  const queryWithHash = normQuery.startsWith("#") ? normQuery : "#" + normQuery;
  const queryNoHash = normQuery.startsWith("#") ? normQuery.slice(1) : normQuery;

  if (tags.canonicalTag === queryWithHash) {
    return { matches: true, score: 10, matchedType: "Exact" };
  }
  
  if (tags.compactTag === queryWithHash || tags.compactTag === "#" + queryNoHash.replace(/[^a-z0-9]+/g, "")) {
    return { matches: true, score: 8, matchedType: "Compact" };
  }

  const matchingAlias = tags.semanticAliases.find(alias => 
    alias === queryWithHash || alias === "#" + queryNoHash
  );
  if (matchingAlias) {
    return { matches: true, score: 6, matchedType: "Semantic Alias" };
  }

  if (tags.canonicalTag.startsWith(queryWithHash) || tags.canonicalTag.includes(queryNoHash)) {
    return { matches: true, score: 4, matchedType: "Partial" };
  }

  const cleanLabel = tags.humanTitle.toLowerCase();
  const cleanSummary = node.summary.toLowerCase();
  
  if (cleanLabel.includes(queryNoHash) || cleanSummary.includes(queryNoHash)) {
    return { matches: true, score: 3, matchedType: "Natural Language" };
  }

  const queryWords = queryNoHash.split(/[-_\s]+/);
  const matchingWordsCount = queryWords.filter(qw => qw.length > 2 && (cleanLabel.includes(qw) || cleanSummary.includes(qw))).length;
  if (matchingWordsCount > 0) {
    return { matches: true, score: 1 + matchingWordsCount, matchedType: "Fuzzy" };
  }

  return { matches: false, score: 0, matchedType: "" };
}

export function getNodeLevel(node: { id: string; label: string; weight: number }): number {
  const match = node.label.trim().match(/^(\d+)\.(\d+)/);
  if (match) {
    const sub = match[2];
    if (sub === "0") {
      return 1; // Level 1 (e.g. 1.0, 2.0)
    } else if (sub.length === 1) {
      return 2; // Level 2 (e.g. 1.1, 1.2, 2.1)
    } else {
      return 3; // Level 3 (e.g. 1.11, 2.11)
    }
  }
  
  // Fallback map based on weights scaled from 0.5 to 3.0
  if (node.weight >= 2.5) return 1;
  if (node.weight >= 1.5) return 2;
  return 3;
}

export function sanitizeEdges(
  nodes: { id: string; label: string; weight: number }[],
  edges: { source: string; target: string; relation?: string }[]
): { source: string; target: string; relation?: string }[] {
  if (!nodes || !edges) return [];
  const nodeMap = new Map<string, { id: string; label: string; weight: number }>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  return edges.filter(edge => {
    const srcNode = nodeMap.get(edge.source);
    const tgtNode = nodeMap.get(edge.target);
    if (srcNode && tgtNode) {
      const srcLvl = getNodeLevel(srcNode);
      const tgtLvl = getNodeLevel(tgtNode);
      // Strictly avoid level 3 connecting directly to level 1 (or vice versa)
      if ((srcLvl === 1 && tgtLvl === 3) || (srcLvl === 3 && tgtLvl === 1)) {
        return false;
      }
    }
    return true;
  });
}

export default function App() {
  // Active Profile Handle and Dictionary for multi-brain hot-swapping
  const [activeProfileHandle, setActiveProfileHandle] = useState<string>("@chris.adkins");
  const [allProfilesDict, setAllProfilesDict] = useState<Record<string, StateBlueprint>>(() => {
    const saved = localStorage.getItem("doppelganger_all_profiles_dict_v3");
    if (saved) {
      try {
        const decoded = JSON.parse(saved);
        if (decoded && typeof decoded === "object") {
          return decoded;
        }
      } catch (e) {
        // ignore fallback
      }
    }
    return {
      "@chris.adkins": DEFAULT_MOCK_STATE,
      "@alex.morgan": ALEX_MOCK_STATE,
      "@jordan.lee": JORDAN_MOCK_STATE
    };
  });

  // Automatically sync profiles data to localStorage whenever updated
  useEffect(() => {
    localStorage.setItem("doppelganger_all_profiles_dict_v3", JSON.stringify(allProfilesDict));
  }, [allProfilesDict]);

  // Inactivity tracking for screensaver
  const [inactivityTimeout, setInactivityTimeout] = useState<number>(() => {
    const saved = localStorage.getItem("doppelganger_screensaver_timeout_mins");
    return saved ? parseInt(saved, 10) : 1; // Default to 1 min if inactivity
  });
  const [isScreensaverActive, setIsScreensaverActive] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(81);

  useEffect(() => {
    if (headerRef.current) {
      setHeaderHeight(headerRef.current.offsetHeight);
    }
    const handleResize = () => {
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.offsetHeight);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isScreensaverActive]);

  const [isFederatedExpanded, setIsFederatedExpanded] = useState<boolean>(true);
  
  // Keep track of which profiles are currently unlocked in the horizontal identity bar
  const [unlockedProfileHandles, setUnlockedProfileHandles] = useState<string[]>([]);

  // Only show profiles that are unlocked or currently active to prevent unrequested leakage
  const visibleSwitcherProfiles = useMemo(() => {
    return PROFILES.filter(p => unlockedProfileHandles.includes(p.handle) || p.handle === activeProfileHandle);
  }, [unlockedProfileHandles, activeProfileHandle]);

  // Track the history of visited profiles to support reverting back when a profile is closed
  const [profileHistoryStack, setProfileHistoryStack] = useState<string[]>([]);

  useEffect(() => {
    if (inactivityTimeout <= 0) {
      setIsScreensaverActive(false);
      return;
    }

    let timeoutId: any;

    const resetTimer = () => {
      setIsScreensaverActive(false);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsScreensaverActive(true);
      }, inactivityTimeout * 60 * 1000);
    };

    resetTimer();

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    events.forEach(event => window.addEventListener(event, resetTimer));

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [inactivityTimeout]);

  // Compares and reads graphState from active profile dynamically sanitized
  const rawGraphState = allProfilesDict[activeProfileHandle] || DEFAULT_MOCK_STATE;

  const graphState = useMemo(() => {
    if (!rawGraphState) return rawGraphState;
    return {
      ...rawGraphState,
      edges: sanitizeEdges(rawGraphState.activeNodes || [], rawGraphState.edges || [])
    };
  }, [rawGraphState]);

  // Custom setter wrapper that routes the state modification to the correct profile in our dictionary
  const setGraphState = (newState: StateBlueprint | ((prev: StateBlueprint) => StateBlueprint)) => {
    setAllProfilesDict(prev => {
      const current = prev[activeProfileHandle] || DEFAULT_MOCK_STATE;
      const updated = typeof newState === "function" ? (newState as any)(current) : newState;
      const sanitized = {
        ...updated,
        edges: sanitizeEdges(updated.activeNodes || [], updated.edges || [])
      };
      return {
        ...prev,
        [activeProfileHandle]: sanitized
      };
    });
  };

  // Search Input and suggestions visible status
  const [searchVal, setSearchVal] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Onboarding overlay visible and persistence state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [dontRemindMe, setDontRemindMe] = useState(false);

  // Settings active modal display status
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Staging area state
  const [stagedReasoning, setStagedReasoning] = useState<string | null>(null);
  const [stagedCards, setStagedCards] = useState<ProposalCard[]>([]);
  const [proposedState, setProposedState] = useState<StateBlueprint | null>(null);

  // Journal Input
  const [journalText, setJournalText] = useState("");
  const [isCompacting, setIsCompacting] = useState(false);

  // Visitor Chat & View
  const [chatQuery, setChatQuery] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isQuerying, setIsQuerying] = useState(false);
  const [activeView, setActiveView] = useState<'owner' | 'visitor' | 'admin'>('visitor');

  // Custom views and node positioning state
  const [savedViews, setSavedViews] = useState<{ id: string; name: string; nodePositions: { [nodeId: string]: { x: number; y: number } } }[]>([]);
  const [activeViewId, setActiveViewId] = useState<string>("default"); // "default", "dirty", or saved view id
  const [currentNodePositions, setCurrentNodePositions] = useState<{ [nodeId: string]: { x: number; y: number } } | null>(null);
  const [showSaveViewModal, setShowSaveViewModal] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [viewToDelete, setViewToDelete] = useState<{ id: string; name: string } | null>(null);
  const [viewResetTrigger, setViewResetTrigger] = useState<number>(0);

  // Load saved views when activeProfileHandle changes
  useEffect(() => {
    const saved = localStorage.getItem(`doppelganger_saved_views_v3_${activeProfileHandle}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSavedViews(parsed);
          return;
        }
      } catch (_) {}
    }
    setSavedViews([]);
  }, [activeProfileHandle]);

  // Whenever activeProfileHandle changes, reset activeViewId and currentNodePositions
  useEffect(() => {
    setActiveViewId("default");
    setCurrentNodePositions(null);
  }, [activeProfileHandle]);

  const saveViewsForProfile = (views: typeof savedViews) => {
    setSavedViews(views);
    localStorage.setItem(`doppelganger_saved_views_v3_${activeProfileHandle}`, JSON.stringify(views));
  };

  const [adminJsonText, setAdminJsonText] = useState("");
  const [adminJsonError, setAdminJsonError] = useState<string | null>(null);
  const [adminJsonSuccess, setAdminJsonSuccess] = useState(false);

  // Validate the structural formatting integrity of raw graph state before applying to memory dictionary
  const handleSaveAdminJson = () => {
    try {
      setAdminJsonError(null);
      setAdminJsonSuccess(false);
      const parsed = JSON.parse(adminJsonText);

      // Verify overall structure
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Blueprint state must be a valid JSON object.");
      }
      if (!Array.isArray(parsed.activeNodes)) {
        throw new Error("Missing 'activeNodes' array in JSON root.");
      }
      if (!Array.isArray(parsed.edges)) {
        throw new Error("Missing 'edges' array in JSON root.");
      }
      if (!Array.isArray(parsed.memories)) {
        throw new Error("Missing 'memories' array in JSON root.");
      }

      // Verify nodes
      parsed.activeNodes.forEach((node: any, idx: number) => {
        if (!node.id || typeof node.id !== "string") {
          throw new Error(`Node at index ${idx} is missing a string 'id' identifier attribute.`);
        }
        if (!node.label || typeof node.label !== "string") {
          throw new Error(`Node #${node.id || idx} is missing a string 'label' description.`);
        }
        if (typeof node.weight !== "number") {
          throw new Error(`Node #${node.id || idx} must specify a numeric 'weight' value (e.g. 3.0, 2.0, 1.0).`);
        }
      });

      // Save valid state back to current active profile
      setGraphState(parsed);
      setAdminJsonSuccess(true);
      setTimeout(() => setAdminJsonSuccess(false), 3000);
    } catch (err: any) {
      setAdminJsonError(err.message || "Invalid JSON array formatting structure.");
    }
  };
  const [visitorSelectedNodeId, setVisitorSelectedNodeId] = useState<string | null>(null);
  const [ownerSelectedNodeId, setOwnerSelectedNodeId] = useState<string | null>(null);
  const selectedNodeId = activeView === 'owner' ? ownerSelectedNodeId : visitorSelectedNodeId;
  const setSelectedNodeId = activeView === 'owner' ? setOwnerSelectedNodeId : setVisitorSelectedNodeId;
  const [selectedChatTopic, setSelectedChatTopic] = useState<string | null>(null);
  const [unlockedTokens, setUnlockedTokens] = useState<string[]>([]);
  const [vaultInput, setVaultInput] = useState("");
  const [passcodeNodeToUnlock, setPasscodeNodeToUnlock] = useState<ActiveNode | null>(null);
  const [localPasscodeInput, setLocalPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Extract owner profile metadata from active state with fallbacks for hot-swapping
  const ownerName = graphState.owner?.name || "Chris Adkins";
  const ownerTitle = graphState.owner?.title || "Design Program Manager";
  const ownerEmail = graphState.owner?.email || "webpmp@gmail.com";
  const ownerPhotoUrl = graphState.owner?.photoUrl || "/image-chris-adkins.png";

  // Localized handle parser & builder matching structure @firstname.lastname
  const ownerHandle = useMemo(() => {
    if (!ownerEmail) return "@user";
    const userPart = ownerEmail.split("@")[0].toLowerCase().trim();
    if (userPart.includes(".")) {
      return `@${userPart}`;
    } else if (ownerName) {
      const nameParts = ownerName.toLowerCase().trim().split(/\s+/);
      if (nameParts.length >= 2) {
        return `@${nameParts[0]}.${nameParts[nameParts.length - 1]}`;
      }
      return `@${userPart || nameParts[0] || "user"}`;
    }
    return `@${userPart || "user"}`;
  }, [ownerEmail, ownerName]);

  // Dynamically synchronize the web browser tab title vertical bar pattern when user payload is hot-swapped
  useEffect(() => {
    document.title = `${ownerName} | Doppelgänger`;
  }, [ownerName]);

  // Synchronically load current profile JSON state model into active admin workspace context
  useEffect(() => {
    if (activeView === 'admin') {
      setAdminJsonText(JSON.stringify(graphState, null, 2));
      setAdminJsonError(null);
      setAdminJsonSuccess(false);
    }
  }, [activeView, activeProfileHandle, graphState]);

  // Profile context switching handler with UI cleanup and URL state synchronization
  const handleSwitchProfile = (handle: string) => {
    const profile = PROFILES.find(p => p.handle.toLowerCase() === handle.toLowerCase());
    if (!profile) return;
    
    // Switch the active handle state (dictionary wrapper takes care of the graphState swap)
    setActiveProfileHandle(profile.handle);
    setChatMessages([]);
    setVisitorSelectedNodeId(null);
    setOwnerSelectedNodeId(null);

    // Make sure it is in the list of unlocked profile handles
    setUnlockedProfileHandles(prev => {
      if (prev.includes(profile.handle)) return prev;
      return [...prev, profile.handle];
    });

    // Push to the history stack for back/revert functionality on close
    setProfileHistoryStack(prev => {
      return [...prev, profile.handle];
    });

    // Synchronize browser tab and URL parameters
    document.title = `${profile.name} | Doppelgänger`;
    const params = new URLSearchParams(window.location.search);
    params.set("brain", profile.handle);
    window.history.pushState(null, "", "?" + params.toString());

    // Trigger onboarding overlay checking for this user profile context
    const isDismissed = localStorage.getItem(`doppelganger_overlay_dismissed_v3_${profile.handle}`) === "true";
    const sessionShown = sessionStorage.getItem("doppelganger_onboarding_session_shown") === "true";
    if (!isDismissed && !sessionShown) {
      setShowOnboarding(true);
      setDontRemindMe(false);
      sessionStorage.setItem("doppelganger_onboarding_session_shown", "true");
    } else {
      setShowOnboarding(false);
      setDontRemindMe(isDismissed);
    }
  };

  // Close profile handler: removes a profile from the identity bar and reverts to previous active map
  const handleCloseProfile = (handleToRemove: string) => {
    // Compute next unlocked profile list
    const nextUnlocked = unlockedProfileHandles.filter(h => h !== handleToRemove);
    setUnlockedProfileHandles(nextUnlocked);

    // Compute next history stack
    const nextStack = profileHistoryStack.filter(h => h !== handleToRemove);
    setProfileHistoryStack(nextStack);

    // If the closed profile was the active one, we must revert back
    if (activeProfileHandle === handleToRemove) {
      let nextActive = "@chris.adkins";
      for (let i = nextStack.length - 1; i >= 0; i--) {
        if (nextUnlocked.includes(nextStack[i])) {
          nextActive = nextStack[i];
          break;
        }
      }
      if (!nextUnlocked.includes(nextActive) && nextUnlocked.length > 0) {
        nextActive = nextUnlocked[0];
      }
      handleSwitchProfile(nextActive);
    }
  };

  // Parse URL query on mount for 'brain' parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const brainParam = params.get("brain");
    let initialMatch = null;
    if (brainParam) {
      const lower = brainParam.toLowerCase().trim();
      const match = PROFILES.find(p => p.handle.toLowerCase() === lower);
      if (match) {
        setActiveProfileHandle(match.handle);
        initialMatch = match;
      }
    }

    const startHandle = initialMatch ? initialMatch.handle : "@chris.adkins";
    setUnlockedProfileHandles([startHandle]);
    setProfileHistoryStack([startHandle]);

    // Determine onboarding overlay on current profile on first load
    const startHandle_ = initialMatch ? initialMatch.handle : "@chris.adkins";
    const dismissed = localStorage.getItem(`doppelganger_overlay_dismissed_v3_${startHandle_}`) === "true";
    const sessionShown = sessionStorage.getItem("doppelganger_onboarding_session_shown") === "true";
    if (!dismissed && !sessionShown) {
      setShowOnboarding(true);
      sessionStorage.setItem("doppelganger_onboarding_session_shown", "true");
    } else {
      setShowOnboarding(false);
    }
    setDontRemindMe(dismissed);
  }, []);

  // Idle Activity Detection: Show onboarding privacy overlay after 1 minute of inactivity
  useEffect(() => {
    const isDismissed = localStorage.getItem(`doppelganger_overlay_dismissed_v3_${activeProfileHandle}`) === "true";
    if (showOnboarding || dontRemindMe || isDismissed) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const resetIdleTimer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        setShowOnboarding(true);
        // Include an elegant notice in the chat messages when privacy auto-lock activates
        setChatMessages(prev => [
          ...prev,
          {
            id: `security-lock-${Date.now()}`,
            sender: "doug",
            text: "🔒 System auto-locked after 1 minute of inactivity. Your personal knowledge graph's privacy is protected.",
            timestamp: new Date().toLocaleTimeString()
          }
        ]);
      }, 60000); // 1 minute of inactivity
    };

    // Initialize timer on mount or when onboarding is dismissed
    resetIdleTimer();

    const activityEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    
    activityEvents.forEach(event => {
      window.addEventListener(event, resetIdleTimer, { passive: true });
    });

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetIdleTimer);
      });
    };
  }, [showOnboarding, dontRemindMe, activeProfileHandle]);

  // Handle onboarding closing and save preference to database/device localstorage fallback
  const handleCloseOnboarding = () => {
    if (dontRemindMe) {
      localStorage.setItem(`doppelganger_overlay_dismissed_v3_${activeProfileHandle}`, "true");
    } else {
      localStorage.removeItem(`doppelganger_overlay_dismissed_v3_${activeProfileHandle}`);
    }
    sessionStorage.setItem("doppelganger_onboarding_session_shown", "true");
    setShowOnboarding(false);
  };

  // Voice speech recognition definitions and functions
  const [isRecordingJournal, setIsRecordingJournal] = useState(false);
  const [isRecordingChat, setIsRecordingChat] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const journalRecognitionRef = useRef<any>(null);
  const chatRecognitionRef = useRef<any>(null);
  const journalBaselineRef = useRef("");
  const chatBaselineRef = useRef("");

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setVoiceSupported(true);
    }
    return () => {
      if (journalRecognitionRef.current) {
        journalRecognitionRef.current.stop();
      }
      if (chatRecognitionRef.current) {
        chatRecognitionRef.current.stop();
      }
    };
  }, []);

  const toggleVoiceJournal = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice speech recognition is not supported in this browser. Please try Chrome or Safari.");
      return;
    }

    if (isRecordingJournal) {
      if (journalRecognitionRef.current) {
        journalRecognitionRef.current.stop();
      }
      setIsRecordingJournal(false);
    } else {
      if (isRecordingChat && chatRecognitionRef.current) {
        chatRecognitionRef.current.stop();
        setIsRecordingChat(false);
      }

      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        // Capture current text at start so we don't overwrite it
        journalBaselineRef.current = journalText;

        recognition.onstart = () => {
          setIsRecordingJournal(true);
        };

        recognition.onresult = (event: any) => {
          let accumulatedSpeech = '';
          let interimSpeech = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              accumulatedSpeech += transcript;
            } else {
              interimSpeech += transcript;
            }
          }

          const baseline = journalBaselineRef.current;
          const fullSpeech = accumulatedSpeech + interimSpeech;

          if (fullSpeech.trim()) {
            setJournalText(baseline ? `${baseline.trim()} ${fullSpeech.trim()}` : fullSpeech.trim());
          }
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsRecordingJournal(false);
        };

        recognition.onend = () => {
          setIsRecordingJournal(false);
        };

        journalRecognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
        setIsRecordingJournal(false);
      }
    }
  };

  const toggleVoiceChat = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice speech recognition is not supported in this browser. Please try Chrome or Safari.");
      return;
    }

    if (isRecordingChat) {
      if (chatRecognitionRef.current) {
        chatRecognitionRef.current.stop();
      }
      setIsRecordingChat(false);
    } else {
      if (isRecordingJournal && journalRecognitionRef.current) {
        journalRecognitionRef.current.stop();
        setIsRecordingJournal(false);
      }

      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        // Capture current queries at start so we don't overwrite it
        chatBaselineRef.current = chatQuery;

        recognition.onstart = () => {
          setIsRecordingChat(true);
        };

        recognition.onresult = (event: any) => {
          let accumulatedSpeech = '';
          let interimSpeech = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              accumulatedSpeech += transcript;
            } else {
              interimSpeech += transcript;
            }
          }

          const baseline = chatBaselineRef.current;
          const fullSpeech = accumulatedSpeech + interimSpeech;

          if (fullSpeech.trim()) {
            setChatQuery(baseline ? `${baseline.trim()} ${fullSpeech.trim()}` : fullSpeech.trim());
          }
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsRecordingChat(false);
        };

        recognition.onend = () => {
          setIsRecordingChat(false);
        };

        chatRecognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
        setIsRecordingChat(false);
      }
    }
  };

  // Bootstrapping function
  const bootstrapLocalGraph = () => {
    setGraphState(DEFAULT_MOCK_STATE);
    // Add info log on chat
    const initialMsg: ChatMessage = {
      id: "initial-msg",
      sender: "doug",
      text: "All systems are loaded! We added 3 sample projects to the map. Two are public, and one is hidden ('Project Aegis'). Try typing 'AEGIS-DECODE' in the passcode entry box to unlock the hidden project!",
      timestamp: new Date().toLocaleTimeString()
    };
    setChatMessages([initialMsg]);
    // Clear staging area
    setStagedReasoning(null);
    setStagedCards([]);
    setProposedState(null);
  };

  // Handle vault key via URL and manual entry
  useEffect(() => {
    // Parse URL parameter e.g., ?vault=AEGIS-DECODE
    const params = new URLSearchParams(window.location.search);
    const vaultParam = params.get("vault");
    if (vaultParam) {
      const upperToken = vaultParam.toUpperCase().trim();
      if (!unlockedTokens.includes(upperToken)) {
        setUnlockedTokens(prev => [...prev, upperToken]);
      }
    }
  }, []);

  const handleUnlockVault = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!vaultInput.trim()) return;
    const token = vaultInput.toUpperCase().trim();
    if (!unlockedTokens.includes(token)) {
      setUnlockedTokens(prev => [...prev, token]);
      // Flash message to the chat
      setChatMessages(prev => [
        ...prev,
        {
          id: `unlock-${Date.now()}`,
          sender: "doug",
          text: `🔑 Code accepted! Under-development project '${token}' is now unlocked. You can see and select it on the project map.`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    }
    setVaultInput("");
  };

  const removeVaultToken = (token: string) => {
    setUnlockedTokens(prev => prev.filter(t => t !== token));
    setChatMessages(prev => [
      ...prev,
      {
        id: `lock-${Date.now()}`,
        sender: "doug",
        text: `🔒 Access code '${token}' removed. The project is hidden again.`,
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Stream Compaction Handler (Loop 1)
  const handleIngestJournal = async (e: FormEvent) => {
    e.preventDefault();
    if (!journalText.trim()) return;

    // Turn off and clean vocal recording if active
    if (isRecordingJournal && journalRecognitionRef.current) {
      try {
        journalRecognitionRef.current.stop();
      } catch (err) {
        console.error("Error stopping journal recording:", err);
      }
      setIsRecordingJournal(false);
    }

    setIsCompacting(true);
    setStagedReasoning(null);
    setStagedCards([]);
    setProposedState(null);

    try {
      const res = await fetch("/api/compaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: graphState,
          journalEntry: journalText
        })
      });

      if (!res.ok) {
        throw new Error("Failed to process journal updates.");
      }

      const data = await res.json();
      setStagedReasoning(data.reasoning);
      setStagedCards(data.cards || []);
      setProposedState(data.proposedState);
    } catch (err: any) {
      console.error(err);
      // Append warning to chat
      setChatMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          sender: "doug",
          text: `❌ Error analyzing your journal: ${err.message || "An unexpected error occurred while analyzing the text."}`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      setIsCompacting(false);
    }
  };

  // Commit proposed staging updates to live local state
  const handleApplyUpdates = () => {
    if (!proposedState) return;
    setGraphState(proposedState);
    setStagedReasoning(null);
    setStagedCards([]);
    setProposedState(null);
    setJournalText("");

    setChatMessages(prev => [
      ...prev,
      {
        id: `apply-${Date.now()}`,
        sender: "doug",
        text: `✅ Updates applied! Your project map is refreshed with the new projects and notes.`,
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  };

  // Localized Search Retrieval & Chat (Loop 3)
  const handleVisitorQuery = async (e?: FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const query = customText || chatQuery;
    if (!query.trim()) return;

    // Turn off and clean vocal recording if active
    if (isRecordingChat && chatRecognitionRef.current) {
      try {
        chatRecognitionRef.current.stop();
      } catch (err) {
        console.error("Error stopping chat recording:", err);
      }
      setIsRecordingChat(false);
    }

    if (!customText) {
      setChatQuery("");
    }

    // Add visitor message to chat
    const visitorMsgId = `visitor-${Date.now()}`;
    setChatMessages(prev => [
      ...prev,
      {
        id: visitorMsgId,
        sender: "visitor",
        text: query,
        timestamp: new Date().toLocaleTimeString()
      }
    ]);

    setIsQuerying(true);

    try {
      const response = await fetch("/api/visitor-query", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "text/event-stream" 
        },
        body: JSON.stringify({
          state: graphState,
          query: query,
          unlockedTokens: unlockedTokens,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error("Query grounding endpoint returned error status.");
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");

      if (!reader) throw new Error("No readable stream reader found.");

      // Setup placeholder message for incoming streaming text
      const assistantMsgId = `doug-${Date.now()}`;
      setChatMessages(prev => [
        ...prev,
        {
          id: assistantMsgId,
          sender: "doug",
          text: "",
          timestamp: new Date().toLocaleTimeString()
        }
      ]);

      let fullAnswerText = "";
      let metadataParsed = false;
      let referenced_nodes: string[] = [];
      let routing_trigger = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const decodedString = decoder.decode(value);
        const lines = decodedString.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonText = line.substring(6).trim();
            if (jsonText === "[DONE]") continue;

            try {
              const parsed = JSON.parse(jsonText);
              if (!metadataParsed && parsed.referenced_nodes !== undefined) {
                // First event containing metadata
                referenced_nodes = parsed.referenced_nodes;
                routing_trigger = parsed.routing_trigger;
                metadataParsed = true;
              } else if (parsed.text !== undefined) {
                // Streaming text chunk
                fullAnswerText += parsed.text;
                // Update message in state
                setChatMessages(prev => 
                  prev.map(msg => 
                    msg.id === assistantMsgId 
                      ? { 
                          ...msg, 
                          text: fullAnswerText,
                          referencedNodes: referenced_nodes,
                          routingTrigger: routing_trigger
                        } 
                      : msg
                  )
                );
              }
            } catch (e) {
              // Ignore invalid lines, grab raw if fallback
            }
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setChatMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          sender: "doug",
          text: `⚠️ Query Synthesis Failure: ${err.message || "Failed to finalize grounded inference on local state arrays."}`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      setIsQuerying(false);
    }
  };

  // Helper filters to split graph elements
  const activeNodes = graphState?.activeNodes || [];

  // Determine what nodes are fully accessible and drawn (Gated isolation)
  const renderedNodes = useMemo(() => {
    return (graphState?.activeNodes || []).filter(n => {
      if (n.node_state !== "active") return false;
      const isIsolated = n.isIsolated === true || n.visibility_status === "isolated_passphrase";
      if (!isIsolated) return true;
      const keyHash = (n.access_key_hash || n.accessKeyHash || "").toUpperCase().trim();
      return unlockedTokens.includes(keyHash);
    });
  }, [graphState?.activeNodes, unlockedTokens]);

  const renderedEdges = useMemo(() => {
    const renderedNodeIds = new Set(renderedNodes.map(n => n.id));
    return (graphState?.edges || []).filter(
      e => renderedNodeIds.has(e.source) && renderedNodeIds.has(e.target)
    );
  }, [graphState?.edges, renderedNodes]);

  const activeSharedNodes = useMemo(() => {
    const data = SHARED_NODES_DATA[activeProfileHandle];
    if (!data) return [];
    const all = [...data.nearby, ...(isFederatedExpanded ? data.federated : [])];
    const seen = new Set<string>();
    const unique: typeof all = [];
    all.forEach(sn => {
      if (!seen.has(sn.id)) {
        seen.add(sn.id);
        unique.push(sn);
      }
    });
    return unique;
  }, [activeProfileHandle, isFederatedExpanded]);

  const findLevel1ParentId = (nodeId: string, nodes: ActiveNode[], edges: Edge[]): string => {
    let currentId = nodeId;
    let safety = 0;
    while (safety < 10) {
      safety++;
      const nodeObj = nodes.find(n => n.id === currentId);
      if (!nodeObj) break;
      if (nodeObj.weight === 3.0) {
        return currentId;
      }
      const edge = edges.find(e => e.source === currentId);
      if (edge) {
        currentId = edge.target;
      } else {
        break;
      }
    }
    return currentId;
  };

  const findSubtreeNodeIds = (parent1Id: string, edges: Edge[]): Set<string> => {
    const result = new Set<string>([parent1Id]);
    const childIds = new Set<string>();
    edges.forEach(e => {
      if (e.target === parent1Id) {
        childIds.add(e.source);
        result.add(e.source);
      }
    });
    edges.forEach(e => {
      if (childIds.has(e.target)) {
        result.add(e.source);
      }
    });
    return result;
  };

  const visibleLocalNodes = useMemo(() => {
    // Default view constraint: If no node is selected, show only Level 1/parent nodes (weight === 3.0)
    const level1Nodes = renderedNodes.filter(n => n.weight === 3.0);
    const visibleIds = new Set(level1Nodes.map(n => n.id));

    if (selectedNodeId) {
      // Find if selectedNodeId is a local node
      const isLocal = renderedNodes.some(n => n.id === selectedNodeId);
      let targetLocalNodeId = "";
      if (isLocal) {
        targetLocalNodeId = selectedNodeId;
      } else {
        // If it's a shared/gray node, it has a parentId which is a local node!
        const sharedNode = activeSharedNodes.find(sn => sn.id === selectedNodeId);
        if (sharedNode) {
          targetLocalNodeId = sharedNode.parentId;
        }
      }

      if (targetLocalNodeId) {
        // Find the Level 1 root parent of this local node
        const lvl1ParentId = findLevel1ParentId(targetLocalNodeId, renderedNodes, graphState?.edges || []);
        if (lvl1ParentId) {
          // Add all descendants of this Level 1 root parent to visibleIds (expanding Level 2/3)
          const subtreeIds = findSubtreeNodeIds(lvl1ParentId, graphState?.edges || []);
          subtreeIds.forEach(id => visibleIds.add(id));
        }
      }
    }

    return renderedNodes.filter(n => visibleIds.has(n.id));
  }, [renderedNodes, selectedNodeId, graphState?.edges, activeSharedNodes]);

  const visibleSharedNodes = useMemo(() => {
    // If no node has been selected/clicked, we do NOT show any gray/shared nodes yet.
    if (!selectedNodeId) return [];

    // Find if selectedNodeId is a local node
    const isLocal = renderedNodes.some(n => n.id === selectedNodeId);
    let targetLocalNodeId = "";
    if (isLocal) {
      targetLocalNodeId = selectedNodeId;
    } else {
      // If it's a shared/gray node, retrieve its parentId (which is a local node!)
      const sharedNode = activeSharedNodes.find(sn => sn.id === selectedNodeId);
      if (sharedNode) {
        targetLocalNodeId = sharedNode.parentId;
      }
    }

    if (!targetLocalNodeId) return [];

    // Find the Level 1 root parent of this local node tree
    const activeLevel1Id = findLevel1ParentId(targetLocalNodeId, renderedNodes, graphState?.edges || []);
    if (!activeLevel1Id) return [];

    // Filter shared nodes: only show shared nodes that are connected to visible local nodes
    // AND resolve to the exact active Level 1 root parent we clicked on.
    const visibleLocalIds = new Set(visibleLocalNodes.map(n => n.id));
    return activeSharedNodes.filter(sn => {
      if (!visibleLocalIds.has(sn.parentId)) return false;
      const parentLvl1 = findLevel1ParentId(sn.parentId, renderedNodes, graphState?.edges || []);
      return parentLvl1 === activeLevel1Id;
    });
  }, [selectedNodeId, renderedNodes, activeSharedNodes, graphState?.edges, visibleLocalNodes]);

  const mergedNodes = useMemo(() => {
    const local = visibleLocalNodes.map(n => ({
      ...n,
      doppelgangerId: activeProfileHandle,
      ownerId: activeProfileHandle
    }));
    const shared = visibleSharedNodes.map(sn => ({
      ...sn,
      doppelgangerId: sn.ownerHandle || "shared",
      ownerId: sn.ownerHandle || "shared"
    }));
    return [...local, ...shared];
  }, [visibleLocalNodes, visibleSharedNodes, activeProfileHandle]);

  const mergedEdges = useMemo(() => {
    const visibleLocalIds = new Set(visibleLocalNodes.map(n => n.id));
    const activeLocalEdges = renderedEdges.filter(
      e => visibleLocalIds.has(e.source) && visibleLocalIds.has(e.target)
    );

    const sharedEdges = visibleSharedNodes.map(sn => ({
      source: sn.id,
      target: sn.parentId,
      relation: "connected_shared"
    }));
    return [...activeLocalEdges, ...sharedEdges];
  }, [renderedEdges, visibleLocalNodes, visibleSharedNodes]);

  const selectedNodeObj = useMemo(() => {
    return mergedNodes.find(n => n.id === selectedNodeId) || null;
  }, [mergedNodes, selectedNodeId]);

  // Unlock other doppelganger profiles when clicking on one of their gray nodes on the map
  useEffect(() => {
    if (!selectedNodeId) return;
    const nodeObj = mergedNodes.find(n => n.id === selectedNodeId);
    if (nodeObj && (nodeObj as any).isShared && (nodeObj as any).ownerHandle) {
      const handle = (nodeObj as any).ownerHandle;
      setUnlockedProfileHandles(prev => {
        if (prev.includes(handle)) return prev;
        return [...prev, handle];
      });
    }
  }, [selectedNodeId, mergedNodes]);

  // Retrieve the full logical breadcrumb path upwards (Parent > Child > Grandchild) for a reference node
  const getNodePath = (nodeId: string): { id: string; label: string }[] => {
    const nodesPool = graphState?.activeNodes || [];
    const edgesPool = graphState?.edges || [];
    const target = nodesPool.find(n => n.id === nodeId);
    if (!target) return [];

    const path: { id: string; label: string }[] = [{ id: target.id, label: target.label }];
    let current = target;

    let safety = 0;
    while (current && current.weight < 3.0 && safety < 10) {
      safety++;
      const currentLevel = current.weight;
      const targetWeight = currentLevel + 1.0;

      const incidentEdges = edgesPool.filter(e => e.source === current.id || e.target === current.id);
      let nextNode: typeof target | undefined = undefined;

      for (const edge of incidentEdges) {
        const neighborId = edge.source === current.id ? edge.target : edge.source;
        const neighborNode = nodesPool.find(n => n.id === neighborId);
        if (neighborNode && neighborNode.weight === targetWeight) {
          nextNode = neighborNode;
          break;
        }
      }

      if (!nextNode) {
        for (const edge of incidentEdges) {
          const neighborId = edge.source === current.id ? edge.target : edge.source;
          const neighborNode = nodesPool.find(n => n.id === neighborId);
          if (neighborNode && neighborNode.weight > currentLevel) {
            nextNode = neighborNode;
            break;
          }
        }
      }

      if (nextNode) {
        path.unshift({ id: nextNode.id, label: nextNode.label });
        current = nextNode;
      } else {
        break;
      }
    }

    return path;
  };

  // Check if the user has access to the selected node
  const hasAccessToSelected = useMemo(() => {
    if (!selectedNodeObj) return false;
    const isIsolated = selectedNodeObj.isIsolated === true || selectedNodeObj.visibility_status === "isolated_passphrase";
    if (!isIsolated) return true;
    const keyHash = (selectedNodeObj.access_key_hash || selectedNodeObj.accessKeyHash || "").toUpperCase().trim();
    return unlockedTokens.includes(keyHash);
  }, [selectedNodeObj, unlockedTokens]);

  const nodeMemories = useMemo(() => {
    if (!selectedNodeObj || !hasAccessToSelected) return [];
    return (graphState?.memories || []).filter(m => m.node_id === selectedNodeObj.id);
  }, [graphState?.memories, selectedNodeObj, hasAccessToSelected]);

  const nodeDetails = useMemo(() => {
    if (!selectedNodeObj) return { decText: "", created: "", query: "" };
    const isShared = (selectedNodeObj as any).isShared;
    const decText = isShared
      ? `${(selectedNodeObj as any).relationshipSummary || ""}\n\nRelated Areas: ${(selectedNodeObj as any).relatedAreas?.join(", ") || ""}`
      : (nodeMemories.map(m => m.content).join("\n\n") || "No additional records found.");
    
    const created = isShared
      ? "May 10, 2026"
      : getMemoryDate(nodeMemories[0]?.source_origin || "Journal_v1");

    const query = `tell me more about the project note: ${selectedNodeObj.label} - ${selectedNodeObj.summary} - ${decText}`;
    return { decText, created, query };
  }, [selectedNodeObj, nodeMemories]);

  const isExternal = useMemo(() => {
    return !!(selectedNodeObj && (selectedNodeObj as any).isShared);
  }, [selectedNodeObj]);

  const secondaryIdentity = useMemo(() => {
    if (!isExternal || !selectedNodeObj) return null;
    const sNode = selectedNodeObj as any;
    const handle = sNode.ownerHandle || "@alex.morgan";
    const photoUrl = handle === "@alex.morgan" 
      ? "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
      : handle === "@jordan.lee"
      ? "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
      : "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80";
    return {
      name: sNode.ownerName || "Alex Morgan",
      title: sNode.ownerTitle || "Software Engineer, Mobile Platform",
      photoUrl,
      handle
    };
  }, [isExternal, selectedNodeObj]);

  const activeProfile = useMemo(() => {
    return PROFILES.find(p => p.handle.toLowerCase() === activeProfileHandle.toLowerCase()) || PROFILES[0];
  }, [activeProfileHandle]);

  const externalProfiles = useMemo(() => {
    const list: typeof PROFILES = [];
    const seenHandles = new Set<string>();

    const activeLower = activeProfileHandle.toLowerCase().trim();

    // Add selected gray node's owner if any
    if (selectedNodeObj && (selectedNodeObj as any).isShared && (selectedNodeObj as any).ownerHandle) {
      const handle = ((selectedNodeObj as any).ownerHandle || "").trim();
      const lower = handle.toLowerCase();
      if (lower && lower !== activeLower && !seenHandles.has(lower)) {
        const p = PROFILES.find(p => p.handle.toLowerCase() === lower);
        if (p) {
          list.push(p);
          seenHandles.add(lower);
        }
      }
    }

    // Add other unique gray node owners currently connected
    activeSharedNodes.forEach(sn => {
      const handle = (sn.ownerHandle || "").trim();
      const lower = handle.toLowerCase();
      if (lower && lower !== activeLower && !seenHandles.has(lower)) {
        const p = PROFILES.find(p => p.handle.toLowerCase() === lower);
        if (p) {
          list.push(p);
          seenHandles.add(lower);
        }
      }
    });

    return list;
  }, [activeProfileHandle, selectedNodeObj, activeSharedNodes]);

  // Dynamic search matching for autocomplete suggestions
  const profileSuggestions = useMemo(() => {
    if (!searchVal.startsWith("@")) return [];
    const query = searchVal.slice(1).toLowerCase().trim();
    const allowed = PROFILES.filter(p => unlockedProfileHandles.includes(p.handle) || p.handle === activeProfileHandle);
    return allowed.filter(p => 
      p.handle.toLowerCase().includes(query) || 
      p.name.toLowerCase().includes(query) ||
      p.title.toLowerCase().includes(query)
    );
  }, [searchVal, unlockedProfileHandles, activeProfileHandle]);

  const nodeSuggestions = useMemo(() => {
    if (searchVal.startsWith("@")) return [];
    const query = searchVal.startsWith("#") ? searchVal.slice(1).toLowerCase().trim() : searchVal.toLowerCase().trim();
    if (!query) return [];

    const scored = mergedNodes.map(node => {
      const matchResult = matchNodeSearch(node, query);
      return { node, ...matchResult };
    }).filter(res => res.matches);

    scored.sort((a, b) => b.score - a.score);

    return scored.map(res => res.node).slice(0, 5);
  }, [searchVal, mergedNodes]);

  const searchResultsGrouped = useMemo(() => {
    if (searchVal.startsWith("@")) return {};
    const query = searchVal.startsWith("#") ? searchVal.slice(1).toLowerCase().trim() : searchVal.toLowerCase().trim();
    if (!query) return {};

    const scored = mergedNodes.map(node => {
      const matchResult = matchNodeSearch(node, query);
      return { node, ...matchResult };
    }).filter(res => res.matches);

    scored.sort((a, b) => b.score - a.score);

    const matches = scored.map(res => res.node);

    const groups: Record<string, typeof matches> = {};
    matches.forEach(node => {
      let projectGroup = "General Nodes";
      if (node.id.startsWith("node-1") || node.label.toLowerCase().includes("mobile") || node.id.includes("1.")) {
        projectGroup = "Mobile App Redesign";
      } else if (node.id.startsWith("node-2") || node.label.toLowerCase().includes("kinetic") || node.id.includes("2.")) {
        projectGroup = "Kinetic Type Prototype V2";
      } else if (node.id.startsWith("node-3") || node.label.toLowerCase().includes("sprint") || node.id.includes("3.")) {
        projectGroup = "Design Sprints Planning";
      } else if (node.id.startsWith("node-a1")) {
        projectGroup = "Platform Developer Experience";
      } else if (node.id.startsWith("node-a2")) {
        projectGroup = "Federated GraphQL Hub";
      } else if (node.id.startsWith("node-j")) {
        projectGroup = "Design Sprints Planning";
      } else if (node.id.startsWith("node-4") || node.label.toLowerCase().includes("brand") || node.id.includes("4.")) {
        projectGroup = "Branding Update";
      } else {
        projectGroup = "Integrated Projects";
      }
      if (!groups[projectGroup]) groups[projectGroup] = [];
      groups[projectGroup].push(node);
    });
    return groups;
  }, [searchVal, mergedNodes]);

  const doppelgangerMatches = useMemo(() => {
    if (searchVal.startsWith("@")) return [];
    const query = searchVal.startsWith("#") ? searchVal.slice(1).toLowerCase().trim() : searchVal.toLowerCase().trim();
    if (!query) return [];

    const allowed = PROFILES.filter(p => unlockedProfileHandles.includes(p.handle) || p.handle === activeProfileHandle);
    return allowed.filter(prof => {
      const matchesNode = prof.initialState.activeNodes.some(n => {
        const isIsolated = n.isIsolated || n.visibility_status === "isolated_passphrase";
        if (isIsolated && !unlockedTokens.includes((n.access_key_hash || n.accessKeyHash || "").toUpperCase().trim())) {
          return false;
        }
        return matchNodeSearch(n, query).matches;
      });
      const matchesMem = prof.initialState.memories.some(m => {
        const assocNode = prof.initialState.activeNodes.find(n => n.id === m.node_id);
        if (assocNode) {
          const isIsolated = assocNode.isIsolated || assocNode.visibility_status === "isolated_passphrase";
          if (isIsolated && !unlockedTokens.includes((assocNode.access_key_hash || assocNode.accessKeyHash || "").toUpperCase().trim())) {
            return false;
          }
        }
        return m.content.toLowerCase().includes(query);
      });
      return matchesNode || matchesMem;
    });
  }, [searchVal, unlockedTokens, unlockedProfileHandles, activeProfileHandle]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!searchVal.trim()) return;
    const cleanTerm = searchVal.trim().toUpperCase();
    
    // Check if cleanTerm matches any access key hash of isolated nodes across all profiles
    let foundIsolatedNode: any = null;
    PROFILES.forEach(p => {
      const match = p.initialState.activeNodes.find(n => {
        const hash = (n.access_key_hash || n.accessKeyHash || "").toUpperCase().trim();
        return hash === cleanTerm;
      });
      if (match) foundIsolatedNode = match;
    });
    
    if (foundIsolatedNode) {
      if (!unlockedTokens.includes(cleanTerm)) {
        setUnlockedTokens(prev => [...prev, cleanTerm]);
        setChatMessages(prev => [
          ...prev,
          {
            id: `unlock-${Date.now()}`,
            sender: "doug",
            text: `🔑 Passcode accepted! Project '${foundIsolatedNode.label}' has been unlocked and populated into the active knowledge space.`,
            timestamp: new Date().toLocaleTimeString()
          }
        ]);
        setSearchVal("");
        setShowSuggestions(false);
      }
    }
  };

  // User templates state backed by localStorage
  const [myTemplates, setMyTemplates] = useState<{ label: string; text: string }[]>(() => {
    const saved = localStorage.getItem("doppelganger_user_templates_v3");
    if (saved) {
      try {
        const decoded = JSON.parse(saved);
        if (Array.isArray(decoded)) return decoded;
      } catch (e) {
        // ignore fallback
      }
    }
    return []; // starts empty
  });

  useEffect(() => {
    localStorage.setItem("doppelganger_user_templates_v3", JSON.stringify(myTemplates));
  }, [myTemplates]);

  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");

  const handleSaveCurrentAsTemplate = () => {
    if (!journalText.trim()) {
      alert("Please type some structural content in the journal field first before saving as a template.");
      return;
    }
    if (!newTemplateName.trim()) {
      alert("Please specify a name for your template.");
      return;
    }
    setMyTemplates(prev => [
      ...prev,
      { label: newTemplateName.trim(), text: journalText.trim() }
    ]);
    setNewTemplateName("");
    setIsAddingTemplate(false);
  };

  const chatSuggestedTopics = [
    {
      topic: "Status and progress",
      questions: [
        "What is the current state of the project?",
        "What has been completed so far?",
        "What is currently in progress?",
        "Are we on schedule or behind?"
      ]
    },
    {
      topic: "Scope and requirements",
      questions: [
        "Has the scope changed since kickoff?",
        "Are requirements still stable?",
        "What features are in or out of scope?",
        "Are there any unclear requirements blocking work?"
      ]
    },
    {
      topic: "Timeline and delivery",
      questions: [
        "When is the expected completion date?",
        "What milestones have been reached?",
        "What milestones are next?",
        "What is the critical path?"
      ]
    },
    {
      topic: "Risks and blockers",
      questions: [
        "What is currently blocking progress?",
        "What risks could delay delivery?",
        "Are there dependencies on other teams or vendors?",
        "What issues are unresolved?"
      ]
    },
    {
      topic: "Resources and capacity",
      questions: [
        "Do we have enough people/time/budget?",
        "Are any roles understaffed?",
        "Is workload balanced across the team?"
      ]
    },
    {
      topic: "Quality and validation",
      questions: [
        "Is the work meeting acceptance criteria?",
        "Have tests or reviews been completed?",
        "Are there known defects or technical debt accumulating?"
      ]
    },
    {
      topic: "Decision points",
      questions: [
        "What decisions are pending?",
        "Who needs to approve next steps?",
        "What tradeoffs are being considered?"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#0D0D0F] text-zinc-300 flex flex-col antialiased selection:bg-teal-500 selection:text-neutral-900 font-sans">
      {/* Dynamic Inactivity Screensaver Overlay */}
      <AnimatePresence>
        {isScreensaverActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{ top: `${headerHeight}px` }}
            className="fixed bottom-0 left-0 right-0 z-[140] bg-[#0A0A0C]/95 select-none cursor-none flex items-center justify-center overflow-hidden"
            onClick={() => setIsScreensaverActive(false)}
            onMouseMove={() => setIsScreensaverActive(false)}
            onKeyDown={() => setIsScreensaverActive(false)}
          >
            <div className="absolute inset-0 z-0">
              <OnboardingBackground />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Bar */}
      <header ref={headerRef} className="border-b border-[#27272A] bg-[#141417] px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-[150]">
        
        {/* Left: Logo & System Name */}
        <div className="flex items-center gap-4 shrink-0">
          <DoppelgangerLogo className="w-11 h-11" />
          <div className="flex flex-col justify-center h-12">
            <div className="flex items-center gap-2">
              <h1 
                style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '0.25em' }} 
                className="text-xl sm:text-2xl font-bold text-zinc-100 uppercase leading-none"
              >
                Doppelgänger
              </h1>
            </div>
          </div>
        </div>

        {/* Center: Universal Search Bar */}
        <div className={`flex-1 max-w-sm w-full mx-auto relative z-50 transition-all duration-300 ${isScreensaverActive ? "opacity-0 pointer-events-none select-none" : ""}`}>
          <form onSubmit={handleSearchSubmit} className="relative">
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
              <Search className={`w-4 h-4 ${searchVal.startsWith("@") ? "text-[#2DD4BF]" : searchVal.startsWith("#") ? "text-pink-400" : "text-zinc-500"} transition-colors`} />
            </div>
            <input
              type="text"
              value={searchVal}
              onChange={(e) => {
                setSearchVal(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search @username or #topic..."
              className="w-full text-xs bg-[#1C1C21] border border-zinc-800 rounded-xl pl-10 pr-9 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#2DD4BF]/50 focus:ring-1 focus:ring-[#2DD4BF]/30 transition-all font-mono"
            />
            {searchVal && (
              <button
                type="button"
                onClick={() => {
                  setSearchVal("");
                  setShowSuggestions(false);
                }}
                className="absolute inset-y-0 right-3 flex items-center pr-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Autocomplete Suggestions Hub Overlay */}
          {showSuggestions && searchVal.trim().length > 0 && (
            <div className="absolute top-11 left-0 right-0 z-50 bg-[#16161B] border border-[#27272A] rounded-xl shadow-2xl backdrop-blur-md overflow-hidden max-h-[300px] overflow-y-auto">
              
              {/* Profile Suggestions */}
              {searchVal.startsWith("@") && (
                <div className="p-2">
                  <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest px-2.5 py-1 select-none">
                    USER SEARCH - SELECT DOPPELGÄNGER
                  </div>
                  {profileSuggestions.length === 0 ? (
                    <div className="text-xs text-zinc-500 px-2.5 py-2">No matching profiles.</div>
                  ) : (
                    profileSuggestions.map((prof) => (
                      <button
                        key={prof.handle}
                        type="button"
                        onMouseDown={() => {
                          handleSwitchProfile(prof.handle);
                          setSearchVal("");
                          setShowSuggestions(false);
                        }}
                        className="w-full text-left px-2.5 py-2 hover:bg-[#27272A] rounded-lg transition-colors flex items-center gap-3 cursor-pointer group"
                      >
                        <img src={prof.photoUrl} className="w-7 h-7 rounded-full object-cover border border-zinc-800" referrerPolicy="no-referrer" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-zinc-100 group-hover:text-[#2DD4BF] transition-colors font-mono">
                            {prof.handle}
                          </span>
                          <span className="text-[10px] text-zinc-400 truncate leading-tight mt-0.5">
                            {prof.name} &bull; {prof.title}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
              {/* Node Search Suggestions */}
              {!searchVal.startsWith("@") && (
                <div className="p-2">
                  {nodeSuggestions.some(n => (n as any).isShared) && (
                    <div className="mx-2 mb-2 p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl font-sans text-[10.5px] text-zinc-400 leading-normal font-normal shadow-sm animate-fadeIn flex items-start gap-2.5">
                      <span className="text-sm shrink-0">🧠</span>
                      <div className="min-w-0">
                        <span className="font-bold text-zinc-300 font-mono text-[9px] tracking-wider block mb-0.5 uppercase">Neural Alignment Sync Feed</span>
                        Detecting background cooperative alignment with nearby connected minds. Grey nodes indicate background context for collective intelligence.
                      </div>
                    </div>
                  )}
                  <div className="text-[9px] font-bold text-pink-400 uppercase tracking-widest px-2.5 py-1 select-none flex items-center justify-between">
                    <span>Knowledge Mode &mdash; Active Doppelgänger</span>
                    <span className="text-zinc-500 font-mono">Use # to focus search</span>
                  </div>
                  {nodeSuggestions.length === 0 ? (
                    <div className="text-xs text-zinc-500 px-2.5 py-2">No matching node contents. Try another keyword!</div>
                  ) : (
                    nodeSuggestions.map((node) => {
                      const tags = getNodeSearchTags(node);
                      const isShared = (node as any).isShared === true;

                      if (isShared) {
                        return (
                          <button
                            key={node.id}
                            type="button"
                            onMouseDown={() => {
                              setSelectedNodeId(node.id);
                              setShowSuggestions(false);
                            }}
                            className="w-full text-left px-2.5 py-2 hover:bg-[#202025] rounded-lg transition-colors flex flex-col cursor-pointer group border-l-2 border-zinc-700 bg-[#16161B]"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-zinc-400 group-hover:text-zinc-200 transition-colors flex items-center gap-1.5 font-sans">
                                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full"></span>
                                {node.label}
                              </span>
                              <span className="text-[9px] font-mono font-bold text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-805">
                                {tags.canonicalTag || `#${node.id}`}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between gap-2 mt-0.5 pl-3">
                              <span className="text-[10px] text-zinc-500 truncate leading-normal">
                                Shared Node &bull; {node.summary}
                              </span>
                              <span className="text-[8.5px] text-zinc-400 font-mono font-medium uppercase bg-zinc-900 px-1.5 py-0.5 rounded shrink-0 border border-zinc-800">
                                {(node as any).ownerName} &mdash; {(node as any).ownerTitle}
                              </span>
                            </div>
                          </button>
                        );
                      }

                      return (
                        <button
                          key={node.id}
                          type="button"
                          onMouseDown={() => {
                            setSelectedNodeId(node.id);
                            setShowSuggestions(false);
                          }}
                          className="w-full text-left px-2.5 py-2 hover:bg-[#27272A] rounded-lg transition-colors flex flex-col cursor-pointer group"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-zinc-200 group-hover:text-[#2DD4BF] transition-colors flex items-center gap-1.5 font-sans">
                              <span className="w-1.5 h-1.5 bg-[#2DD4BF] rounded-full"></span>
                              {node.label}
                            </span>
                            <span className="text-[9px] font-mono font-bold text-pink-400 bg-pink-400/5 px-2 py-0.5 rounded-full border border-pink-400/10">
                              {tags.canonicalTag}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between gap-2 mt-0.5 pl-3">
                            <span className="text-[10px] text-zinc-400 truncate leading-normal">
                              {node.summary}
                            </span>
                            <span className="text-[8.5px] text-zinc-500 font-mono uppercase bg-zinc-800/20 px-1 py-0.2 rounded shrink-0">
                              Owner: {activeProfileHandle}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}   </div>
              )}

            </div>
          )}
        </div>

        {/* Right: System Settings Option */}
        <div className={`flex items-center gap-3 shrink-0 transition-all duration-300 ${isScreensaverActive ? "opacity-0 pointer-events-none select-none" : ""}`}>
          
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="p-2 rounded-xl bg-[#18181B] border border-[#27272A] hover:bg-[#202025] hover:border-[#2DD4BF]/45 hover:text-[#2DD4BF] transition cursor-pointer text-zinc-400"
            title="System Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

        </div>

      </header>

      {/* Main Panel Content - Conditional Views */}
      <main className="flex-1 p-4 lg:p-6 flex flex-col justify-stretch">
        <AnimatePresence mode="wait">
          {activeView === 'visitor' ? (
            /* Visitor View: Spacious Map and Sidebar Chat/Notes */
            <motion.div
              key="visitor-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch flex-1"
            >
              {/* Spacious Left Column: Interactive Map */}
              <div className="xl:col-span-8 flex flex-col bg-[#141417] border border-[#27272A] rounded-2xl p-5 relative overflow-hidden shadow-2xl h-[550px] xl:h-[calc(100vh-210px)] min-h-[500px]">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#2DD4BF]"></div>
                
                 <div className="flex items-center justify-between gap-4 mb-4 border-b border-[#27272A]/40 pb-3 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap min-w-0">
                    {unlockedProfileHandles.map((handle, idx) => {
                      const p = PROFILES.find(prof => prof.handle.toLowerCase() === handle.toLowerCase());
                      if (!p) return null;
                      const isActive = p.handle === activeProfileHandle;
                      return (
                        <Fragment key={p.handle}>
                          {idx > 0 && <div className="h-8 w-px bg-[#27272A] shrink-0 self-center"></div>}
                          
                          <div 
                            onClick={() => {
                              handleSwitchProfile(p.handle);
                              setSelectedNodeId(null);
                            }}
                            className={`flex items-center gap-3 p-2 rounded-xl text-left cursor-pointer transition select-none group shrink-0 border relative ${
                              isActive 
                                ? 'bg-[#1C1C21]/90 border-[#2DD4BF]/60 text-zinc-100 shadow-md' 
                                : 'bg-[#1A1A1E]/80 border-[#27272A]/80 hover:bg-[#202025] hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
                            }`}
                            title={`Switch active context to ${p.name}`}
                          >
                            <img 
                              src={p.photoUrl} 
                              alt={p.name}
                              className={`w-8 h-8 rounded-full object-cover shrink-0 border ${
                                isActive ? 'border-[#2DD4BF]/45' : 'border-zinc-800'
                              }`}
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0 font-sans text-left">
                              <h4 className={`font-bold text-xs leading-tight transition ${
                                isActive ? 'text-[#2DD4BF]' : 'text-zinc-300 group-hover:text-zinc-100'
                              }`}>{p.name}</h4>
                              <p className="text-[9.5px] text-zinc-400 mt-0.5 max-w-[140px] sm:max-w-[200px] font-normal leading-tight truncate">{p.title}</p>
                              <span className={`text-[9px] font-mono block font-medium mt-0.5 leading-none transition ${
                                isActive ? 'text-[#2DD4BF]' : 'text-zinc-500 group-hover:text-[#2dd4bf]'
                              }`}>{p.handle}</span>
                            </div>

                            {/* Revert back close button if there is more than 1 unlocked profile and this isn't the session root profile */}
                            {unlockedProfileHandles.length > 1 && idx > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCloseProfile(p.handle);
                                }}
                                className="p-1 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-500/15 transition shrink-0 ml-1.5 self-start"
                                title="Close Profile map"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* Unlocked Secrets list if any */}
                {unlockedTokens.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-[#0D0D0F] border border-[#27272A]/80 rounded-xl mb-4 text-xs font-mono">
                    <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1">
                      <Unlock className="w-3 h-3 text-emerald-400" />
                      Unlocked Secrets:
                    </span>
                    {unlockedTokens.map((tok, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-[#2DD4BF] flex items-center gap-1.5 hover:bg-zinc-800 transition cursor-pointer"
                        title="Click to lock project"
                        onClick={() => removeVaultToken(tok)}
                      >
                        <Hash className="w-2.5 h-2.5 text-emerald-500" />
                        {tok}
                        <span className="text-red-405 hover:text-red-300 transition ml-1">&times;</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Canvas Area wrapper */}
                <div className="flex-1 relative min-h-0">
                  
                  {/* Search Results Ribbon Container */}
                  {!searchVal.startsWith("@") && searchVal.trim().length > 1 && (
                    <div className="absolute top-4 left-4 right-4 z-20 flex flex-col gap-2 pointer-events-auto max-w-full">
                      
                      {/* 1. Contextual Result Strip */}
                      <div className="bg-[#18181C]/95 border border-[#27272A] rounded-xl p-3 shadow-2xl backdrop-blur-md">
                        <div className="text-[10px] uppercase tracking-wider font-bold text-pink-400 mb-1.5 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 animate-pulse" />
                            <span>Contextual Hub Suggestions ({Object.values(searchResultsGrouped).flat().length || 0} matching nodes)</span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => setSearchVal("")} 
                            className="text-zinc-505 hover:text-zinc-350 transition text-[10px] font-mono cursor-pointer"
                          >
                            Close Results &times;
                          </button>
                        </div>
                        {Object.keys(searchResultsGrouped).length === 0 ? (
                          <div className="text-xs text-zinc-500 font-mono pl-1 py-1">No active workspace nodes matched search term. Try another keyword!</div>
                        ) : (
                          <div className="flex flex-col gap-2 max-h-[120px] overflow-y-auto pr-1">
                            {Object.entries(searchResultsGrouped).map(([projectGroup, nodes]) => (
                              <div key={projectGroup} className="flex flex-col border-l border-zinc-800 pl-2">
                                <span className="text-[9.5px] font-bold text-zinc-400 font-mono tracking-tight mb-1">{projectGroup}</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {(nodes as any[]).map(node => (
                                    <button
                                      key={node.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedNodeId(node.id);
                                        setSelectedChatTopic(node.label);
                                      }}
                                      className={`text-[10px] font-mono px-2 py-1 rounded border transition-all cursor-pointer ${
                                        selectedNodeId === node.id
                                          ? "bg-[#2DD4BF]/10 border-[#2DD4BF] text-[#2DD4BF] font-extrabold"
                                          : "bg-[#1C1C21] border-[#27272A] text-zinc-300 hover:border-[#2DD4BF]/25 hover:text-zinc-100"
                                      }`}
                                    >
                                      {node.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 2. Cross-Doppelgänger Result Strip */}
                      {doppelgangerMatches.length > 0 && (
                        <div className="bg-[#141417]/95 border border-[#27272A] rounded-xl px-3 py-2 flex items-center justify-between gap-4 shadow-xl backdrop-blur-md">
                          <div className="flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-[#2DD4BF]" />
                            <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase select-none">Switch to a matching Doppelgänger:</span>
                          </div>
                          <div className="flex items-center gap-2 overflow-x-auto">
                            {doppelgangerMatches.map(profile => (
                              <button
                                key={profile.handle}
                                type="button"
                                onClick={() => {
                                  handleSwitchProfile(profile.handle);
                                }}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-mono transition-all cursor-pointer ${
                                  activeProfileHandle === profile.handle
                                    ? "bg-[#2DD4BF]/10 border-[#2DD4BF] text-[#2DD4BF] font-bold"
                                    : "bg-[#18181B] border-[#27272A] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                                }`}
                                title={`Switch active memory context to ${profile.name}`}
                              >
                                <img src={profile.photoUrl} className="w-4 h-4 rounded-full object-cover border border-zinc-850" referrerPolicy="no-referrer" />
                                <span>{profile.handle}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  )}


                  {showOnboarding ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 bg-[#0D0D0F] border border-dashed border-[#27272A]/70 rounded-xl font-mono gap-3 min-h-[300px]">
                      <Lock className="w-8 h-8 text-pink-500 animate-pulse" />
                      <div className="text-zinc-200 text-sm font-bold uppercase tracking-widest">MAP LOCKED</div>
                      <p className="text-[11px] text-zinc-500 max-w-xs font-sans leading-normal">
                        Your interactive personal knowledge graph is hidden to protect privacy due to system inactivity/standby. Close the security overlay to resume.
                      </p>
                    </div>
                  ) : (
                    <>
                      <KnowledgeGraphCanvas
                        nodes={mergedNodes}
                        edges={mergedEdges}
                        selectedNodeId={selectedNodeId}
                        unlockedTokens={unlockedTokens}
                        onSelectNode={(id) => {
                          setSelectedNodeId(id === selectedNodeId ? null : id);
                        }}
                        activeViewId={activeViewId}
                        nodePositions={currentNodePositions}
                        onStartDragging={(positions) => {
                          if (activeViewId !== "dirty") {
                            setActiveViewId("dirty");
                            setCurrentNodePositions(positions);
                          }
                        }}
                        onNodeDragged={(positions) => {
                          setCurrentNodePositions(positions);
                        }}
                        activeDoppelgangerId={activeProfileHandle}
                        resetTrigger={viewResetTrigger}
                      />
                      <div className="absolute bottom-4 left-4 z-20 flex flex-wrap gap-2 items-center pointer-events-auto">
                        <button
                          id="btn-view-default"
                          type="button"
                          onClick={() => {
                            setActiveViewId("default");
                            setCurrentNodePositions(null);
                            setViewResetTrigger((prev) => prev + 1);
                          }}
                          className={`px-3 py-1.5 rounded-lg border text-[10px] font-mono tracking-wider backdrop-blur-sm transition-all uppercase font-bold cursor-pointer ${
                            activeViewId === "default"
                              ? "bg-[#2DD4BF]/20 border-[#2DD4BF] text-[#2DD4BF] shadow-lg shadow-[#2DD4BF]/10"
                              : "bg-[#16161B]/80 border-[#27272A] text-zinc-400 hover:text-zinc-200 hover:bg-[#202025]/90"
                          }`}
                        >
                          DEFAULT VIEW
                        </button>

                        {savedViews.map((view) => (
                          <div key={view.id} className="flex items-center gap-1 bg-[#16161B]/80 hover:bg-[#16161B]/95 border border-[#27272A] rounded-lg p-0.5 backdrop-blur-sm transition-all shadow">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveViewId(view.id);
                                setCurrentNodePositions(view.nodePositions);
                              }}
                              className={`px-2 py-1 text-[10px] font-mono tracking-wider rounded transition-all uppercase ${
                                activeViewId === view.id
                                  ? "text-[#2DD4BF] font-bold"
                                  : "text-zinc-400 hover:text-zinc-200"
                              }`}
                            >
                              {view.name}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewToDelete({ id: view.id, name: view.name });
                              }}
                              className="px-1 text-zinc-500 hover:text-red-400 transition cursor-pointer font-bold leading-none text-xs"
                              title="Delete saved view"
                            >
                              ×
                            </button>
                          </div>
                        ))}

                        {activeViewId === "dirty" && (
                          <button
                            id="btn-save-view"
                            type="button"
                            onClick={() => {
                              setShowSaveViewModal(true);
                            }}
                            className="px-3 py-1.5 rounded-lg border border-[#2DD4BF] bg-[#2DD4BF]/10 text-[#2DD4BF] text-[10px] font-mono tracking-wider backdrop-blur-sm hover:bg-[#2DD4BF]/25 transition active:scale-95 cursor-pointer font-bold animate-fadeIn"
                          >
                            SAVE VIEW
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right Column: details and question chat */}
              <div className="xl:col-span-4 flex flex-col gap-6 h-[550px] xl:h-[calc(100vh-210px)] min-h-[500px] overflow-hidden">
                
                {/* Selection Detail Box */}
                <div className={`bg-[#141417] border border-[#27272A] rounded-2xl shadow-xl relative transition-all duration-300 overflow-y-auto ${
                  selectedNodeObj 
                    ? "h-[calc(50%-12px)] opacity-100 p-5" 
                    : "h-0 opacity-0 p-0 border-0 overflow-hidden pointer-events-none"
                }`}>
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                  {selectedNodeObj && (
                    <div className="space-y-4 font-sans text-xs animate-fadeIn min-w-0">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-semibold text-[#2DD4BF] uppercase tracking-wider font-mono">Project Note</span>
                        {(selectedNodeObj.isIsolated || selectedNodeObj.visibility_status === "isolated_passphrase") && (
                          hasAccessToSelected ? (
                            <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-[#2DD4BF] px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                              <Unlock className="w-2.5 h-2.5" /> Unlocked
                            </span>
                          ) : (
                            <span className="text-[9px] bg-pink-500/10 border border-pink-500/20 text-pink-400 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono animate-pulse">
                              <Lock className="w-2.5 h-2.5" /> Locked
                            </span>
                          )
                        )}
                      </div>

                      {!hasAccessToSelected ? (
                        <div className="bg-[#1A1A1E] border border-[#27272A]/80 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 font-mono">
                          <Lock className="w-6 h-6 text-pink-400 animate-pulse" />
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-pink-400 uppercase tracking-widest font-mono">PRIVATE:</span>
                            <button
                              type="button"
                              onClick={() => {
                                setPasscodeNodeToUnlock(selectedNodeObj);
                                setLocalPasscodeInput("");
                                setPasscodeError("");
                              }}
                              className="px-3 py-1 bg-pink-500/15 hover:bg-pink-500/25 text-pink-400 font-bold uppercase text-[10px] tracking-wider border border-pink-500/30 rounded-lg cursor-pointer transition select-none"
                            >
                              [Unlock]
                            </button>
                          </div>
                          <p className="text-[11px] text-zinc-400 max-w-xs leading-normal font-sans">
                            This project is private. Click [Unlock] to enter the passcode and unlock access.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4">
                          <div>
                            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 font-mono">Title</h4>
                            <h3 className="text-sm font-bold text-zinc-100">{selectedNodeObj.label}</h3>
                          </div>

                          <div>
                            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 font-mono">Summary</h4>
                            <p className="text-zinc-300 leading-relaxed font-normal bg-[#1C1C21]/40 p-2.5 rounded-xl border border-zinc-800/40">
                              {selectedNodeObj.summary}
                            </p>
                          </div>

                          <div>
                            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 font-mono">Details</h4>
                            <p className="text-zinc-350 leading-relaxed font-normal bg-[#1C1C21]/40 p-2.5 rounded-xl border border-zinc-800/40 whitespace-pre-wrap">
                              {nodeDetails.decText}
                            </p>
                          </div>

                          <div>
                            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 font-mono">Created</h4>
                            <p className="text-zinc-400 font-medium font-mono">{nodeDetails.created}</p>
                          </div>

                          <div className="pt-1 flex justify-start items-center">
                            <button
                              type="button"
                              onClick={() => {
                                handleVisitorQuery(undefined, nodeDetails.query);
                              }}
                              className="text-[#2DD4BF] hover:underline transition font-medium flex items-center gap-1 cursor-pointer bg-[#2DD4BF]/5 border border-[#2DD4BF]/15 hover:bg-[#2DD4BF]/10 px-3 py-1.5 rounded-xl font-mono text-[11px]"
                            >
                              Ask about this &rarr;
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Friendly Chat Dialogue */}
                <div className={`bg-[#141417] border border-[#27272A] rounded-2xl p-5 flex flex-col overflow-hidden shadow-xl relative transition-all duration-300 ${
                  selectedNodeObj ? "h-[calc(50%-12px)] animate-fadeIn" : "h-full flex-grow flex-1"
                }`}>
                  <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                  
                  <div className="flex justify-between items-start border-b border-[#27272A]/50 pb-2.5 mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[#E4E4E4] flex items-center gap-2">
                        <User className="w-4 h-4 text-purple-400" />
                        Ask anything about my projects
                      </h3>
                      <p className="text-xs text-zinc-500 mt-0.5">The AI assistant will find and reference matching notes on the map.</p>
                    </div>
                  </div>

                  {/* Speech Log Viewport */}
                  <div id="dialog-viewport" className="flex-1 overflow-y-auto bg-[#0D0D0F] border border-[#27272A]/80 rounded-2xl p-4 space-y-3.5 mb-3 flex flex-col">
                    {chatMessages.length === 0 && (
                      <div className="flex-1 flex flex-col items-center justify-center text-zinc-550 text-xs text-center py-6">
                        <HelpCircle className="w-6 h-6 text-zinc-805 mb-2" />
                        <span>Ask any question to search matching notes and topics.</span>
                      </div>
                    )}

                    {chatMessages.map((msg) => {
                      const isVisitor = msg.sender === "visitor";
                      return (
                        <div
                          key={msg.id}
                          className={`flex gap-3 max-w-[90%] ${
                            isVisitor ? "self-end flex-row-reverse" : "self-start"
                          }`}
                        >
                          {/* Sender icon */}
                          <div className={`w-7.5 h-7.5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                            isVisitor ? "bg-zinc-800 text-zinc-300" : "bg-[#2DD4BF]/20 text-[#2DD4BF] border border-[#2DD4BF]/30"
                          }`}>
                            {isVisitor ? "You" : "AI"}
                          </div>
                          
                          {/* Bubble containing simplified text */}
                          <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                            isVisitor
                              ? "bg-zinc-800 text-zinc-100 rounded-tr-none border border-zinc-750"
                              : "bg-[#1A1A1E] border border-zinc-800/80 text-zinc-300 rounded-tl-none"
                          }`}>
                            <div className="font-semibold text-[10px] text-zinc-500 mb-1 flex items-center justify-between gap-4 font-sans">
                              <span>{isVisitor ? "Your Question" : "AI Answer"}</span>
                              <span>{msg.timestamp}</span>
                            </div>
                            <p className="whitespace-pre-line leading-relaxed text-zinc-200">{msg.text}</p>
                             {/* Grounded items highlights */}
                            {msg.referencedNodes && msg.referencedNodes.length > 0 && (
                              <div className="mt-2.5 pt-1.5 border-t border-zinc-800/60 flex flex-col gap-1.5 text-[10px] text-zinc-550">
                                {msg.referencedNodes.map((nId) => {
                                  const pathNodes = getNodePath(nId);
                                  if (pathNodes.length === 0) return null;
                                  return (
                                    <div key={nId} className="flex flex-wrap items-center gap-1 text-[9.5px]">
                                      <span className="font-semibold text-zinc-500 uppercase tracking-widest mr-1 text-[8.5px]">Node:</span>
                                      {pathNodes.map((pNode, pIdx) => (
                                        <span key={pNode.id} className="inline-flex items-center text-zinc-500 font-bold font-sans">
                                          {pIdx > 0 && <span className="text-zinc-700 mx-1 select-none font-bold font-sans">&gt;</span>}
                                          <button
                                            type="button"
                                            onClick={() => setSelectedNodeId(pNode.id)}
                                            className="text-[#2DD4BF] hover:text-[#2DD4BF]/80 underline decoration-[#2DD4BF]/20 hover:decoration-[#2DD4BF]/60 cursor-pointer transition font-mono text-[9.5px] font-medium"
                                          >
                                            {pNode.label}
                                          </button>
                                        </span>
                                      ))}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Redirect Flag to extra mind maps */}
                            {msg.routingTrigger && (
                              <div className="mt-2 p-2 bg-pink-950/20 border border-pink-500/20 rounded-xl flex items-center gap-2 text-[10px] text-pink-400">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>Note: This query is about external files. We recommend exploring main project links!</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {isQuerying && (
                      <div className="flex items-center gap-2 text-zinc-500 text-xs pl-2">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, ease: "linear", duration: 1 }}
                          className="w-3.5 h-3.5 border-2 border-[#2DD4BF] border-t-transparent rounded-full"
                        />
                        <span>Writing reply...</span>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Asking field */}
                  <div className="flex flex-col gap-1.5 w-full">
                    {/* Topic pills & questions area above chat input */}
                    <div className="mb-1 w-full">
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin flex-nowrap shrink-0">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase shrink-0 tracking-wider">Topics:</span>
                        {chatSuggestedTopics.map((item, idx) => {
                          const isSel = selectedChatTopic === item.topic;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setSelectedChatTopic(isSel ? null : item.topic)}
                              className={`text-[10px] px-2.5 py-0.5 rounded-lg transition font-medium cursor-pointer whitespace-nowrap shrink-0 ${
                                isSel
                                  ? "bg-[#2DD4BF] text-neutral-950 font-bold animate-fadeIn"
                                  : "bg-zinc-800 hover:bg-zinc-750 text-zinc-400 hover:text-white"
                              }`}
                            >
                              {item.topic}
                            </button>
                          );
                        })}
                      </div>
                      {/* Related Questions text links (when a topic is clicked) */}
                      {selectedChatTopic && (
                        <div className="flex flex-col gap-1 mt-1 p-2 bg-[#0D0D0F]/85 rounded-xl border border-[#27272A] max-h-[85px] overflow-y-auto w-full text-left">
                          {chatSuggestedTopics
                            .find(t => t.topic === selectedChatTopic)
                            ?.questions.map((q, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  let finalQuery = q;
                                  if (selectedNodeObj) {
                                    finalQuery = `${q} Regarding selected project "${selectedNodeObj.label}" (#${selectedNodeObj.id}).`;
                                  } else {
                                    const parentNode = graphState.activeNodes?.find(n => n.weight === 3.0);
                                    if (parentNode) {
                                      finalQuery = `${q} Regarding parent hub "${parentNode.label}" (#${parentNode.id}).`;
                                    }
                                  }
                                  setChatQuery(finalQuery);
                                }}
                                className="text-left text-[11px] text-[#2DD4BF] hover:text-[#2DD4BF]/80 cursor-pointer hover:underline transition leading-tight whitespace-normal break-words w-full block py-0.5"
                              >
                                • {q}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>

                    {isRecordingChat && (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] text-red-400 font-mono tracking-wide animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping shrink-0" />
                        <span>🎙️ SYSTEM IS LISTENING ... SPEAK NOW</span>
                      </div>
                    )}
                    <form onSubmit={(e) => handleVisitorQuery(e)} className="flex gap-2">
                      <input
                        type="text"
                        value={chatQuery}
                        onChange={(e) => setChatQuery(e.target.value)}
                        placeholder={
                          graphState.activeNodes.length === 0
                            ? "Load sample projects first to ask..."
                            : isRecordingChat
                            ? "Listening... Speak naturally..."
                            : "Ask me anything about my projects and thoughts..."
                        }
                        disabled={isQuerying || graphState.activeNodes.length === 0}
                        className={`flex-1 bg-[#0D0D0F] border rounded-xl px-4 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none transition-all font-sans ${
                          isRecordingChat 
                            ? "border-red-500 ring-2 ring-red-500/20" 
                            : "border-[#27272A] focus:border-[#2DD4BF]/50"
                        }`}
                      />
                      <button
                        id="btn-voice-chat"
                        type="button"
                        onClick={toggleVoiceChat}
                        disabled={isQuerying || graphState.activeNodes.length === 0}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition active:scale-95 cursor-pointer disabled:opacity-40 border ${
                          isRecordingChat
                            ? "bg-red-500/20 border-red-500 text-red-500 animate-pulse hover:bg-red-500/30"
                            : "bg-zinc-800 border-zinc-700 text-[#2DD4BF] hover:bg-zinc-700/80 hover:border-[#2DD4BF]/30"
                        }`}
                        title={isRecordingChat ? "Stop speaking" : "Speak instead of typing"}
                      >
                        {isRecordingChat ? <MicOff className="w-4 h-4 text-red-500" /> : <Mic className="w-4 h-4" />}
                      </button>
                      <button
                        id="btn-send-message"
                        type="submit"
                        disabled={isQuerying || !chatQuery.trim() || graphState.activeNodes.length === 0}
                        className="w-9 h-9 rounded-xl bg-zinc-100 text-neutral-950 hover:bg-[#2DD4BF] hover:text-neutral-950 hover:shadow-lg disabled:opacity-40 shrink-0 flex items-center justify-center transition active:scale-95 cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                </div>

              </div>
            </motion.div>
          ) : activeView === 'owner' ? (
            <motion.div
              key="owner-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start flex-1 min-h-[500px]"
            >
              {/* Left Column: Input Journal Form & Suggestions */}
              <div className="flex flex-col gap-6 w-full h-[740px] xl:h-[calc(100vh-210px)] min-h-[500px] overflow-hidden">
                <div className={`bg-[#141417] border border-[#27272A] rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden shadow-2xl justify-between transition-all duration-300 ${
                  !(isCompacting || stagedReasoning || stagedCards.length > 0) 
                    ? "h-full" 
                    : "h-[45%] min-h-[260px]"
                }`}>
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-[#2DD4BF]"></div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                        <Sparkles className="w-4.5 h-4.5 text-[#2DD4BF]" />
                        Write Your Journal Update
                      </h2>
                      <div className="h-2 w-2 rounded-full bg-[#2DD4BF] animate-pulse"></div>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Write down notes on what you did, new projects, or goals.
                      The AI will read your update and propose edits. <span className="text-amber-400">💡 Tip: Click any node on the map to pre-populate its details for quick editing!</span>
                    </p>
                  </div>

                  <form onSubmit={handleIngestJournal} className="flex-1 flex flex-col justify-between gap-4 mt-2">
                    <div className="flex-1 flex flex-col min-h-[140px] relative">
                      {isRecordingJournal && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] text-red-400 font-mono tracking-wide animate-pulse mb-2 self-start">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping shrink-0" />
                          <span>🎙️ TRANSCRIBING JOURNAL LIVE ... SPEAK FREELY</span>
                        </div>
                      )}
                      <label htmlFor="owner-journal" className="sr-only">Journal Entry Notes</label>
                      <textarea
                        id="owner-journal"
                        value={journalText}
                        onChange={(e) => setJournalText(e.target.value)}
                        placeholder={
                          isRecordingJournal 
                            ? "Listening... Speak your journal notes or projects naturally..." 
                            : "Write your updates here... (e.g. 'Created a secure machine learning pipeline that runs offline.')"
                        }
                        className={`w-full flex-1 bg-[#0D0D0F] border rounded-xl p-3.5 pr-24 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none leading-relaxed transition-all resize-none min-h-[150px] ${
                          isRecordingJournal 
                            ? "border-red-500 ring-2 ring-red-500/20" 
                            : "border-[#27272A] focus:border-[#2DD4BF]/50"
                        }`}
                      ></textarea>
                      <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                        {journalText && (
                          <button
                            id="btn-clear-journal"
                            type="button"
                            onClick={() => {
                              setJournalText("");
                              setSelectedNodeId(null);
                            }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition active:scale-95 cursor-pointer border bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700 hover:border-zinc-650"
                            title="Clear and cancel edit"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          id="btn-voice-journal"
                          type="button"
                          onClick={toggleVoiceJournal}
                          disabled={isCompacting}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition active:scale-95 cursor-pointer border ${
                            isRecordingJournal
                              ? "bg-red-500/20 border-red-500 text-red-500 animate-pulse hover:bg-red-500/30"
                              : "bg-zinc-800 border-zinc-700 text-[#2DD4BF] hover:bg-zinc-700 hover:border-[#2DD4BF]/30"
                          }`}
                          title={isRecordingJournal ? "Stop recording voice" : "Speak your mind map updates"}
                        >
                          {isRecordingJournal ? <MicOff className="w-3.5 h-3.5 text-red-500 animate-pulse" /> : <Mic className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3.5 border-t border-[#27272A]/40 pt-3">
                      {/* My Templates */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">My Templates:</span>
                          <button
                            id="btn-add-template"
                            type="button"
                            onClick={() => {
                              if (!journalText.trim()) {
                                alert("Please type your reusable text snippet in the journal field above, then click '+' to save it as a template!");
                                return;
                              }
                              setIsAddingTemplate(true);
                            }}
                            className="w-4 h-4 rounded bg-zinc-800 border border-zinc-700 hover:border-[#2DD4BF] text-[#2DD4BF] hover:bg-[#2DD4BF]/5 flex items-center justify-center text-xs font-bold transition-all active:scale-95 cursor-pointer"
                            title="Save current journal text as a template"
                          >
                            +
                          </button>
                        </div>

                        {/* Tiny inline form to save a new template */}
                        {isAddingTemplate && (
                          <div className="p-2 bg-[#09090B] border border-zinc-800 rounded-lg space-y-2 animate-fadeIn">
                            <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">Template Name:</label>
                            <div className="flex gap-1.5">
                              <input
                                id="input-new-template-name"
                                type="text"
                                value={newTemplateName}
                                onChange={(e) => setNewTemplateName(e.target.value)}
                                placeholder="e.g. Design Sprint Checklist"
                                className="flex-1 bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-200 px-2 py-1 rounded-md focus:outline-none focus:border-[#2DD4BF]/50 font-mono"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveCurrentAsTemplate();
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={handleSaveCurrentAsTemplate}
                                className="bg-[#2DD4BF] text-neutral-950 px-2.5 py-1 rounded-md hover:bg-[#20bda9] text-[9.5px] font-bold cursor-pointer transition font-mono"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsAddingTemplate(false);
                                  setNewTemplateName("");
                                }}
                                className="bg-zinc-805 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded-md text-[9.5px] font-bold cursor-pointer transition font-mono"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-1">
                          {myTemplates.length === 0 ? (
                            <span className="text-[9.5px] text-zinc-600 italic">No templates saved yet. Write some text inside the journal box and click "+" to build one.</span>
                          ) : (
                            myTemplates.map((samp, i) => (
                              <div key={i} className="group relative flex items-center bg-zinc-805 hover:bg-zinc-750 border border-zinc-805 hover:border-zinc-700 rounded-lg pr-1">
                                <button
                                  type="button"
                                  onClick={() => setJournalText(samp.text)}
                                  className="text-[10px] px-2.5 py-1 text-zinc-300 hover:text-white rounded-l-lg transition font-medium cursor-pointer"
                                  title={samp.text}
                                >
                                  {samp.label}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to delete template "${samp.label}"?`)) {
                                      setMyTemplates(prev => prev.filter((_, idx) => idx !== i));
                                    }
                                  }}
                                  className="text-[10px] text-zinc-500 hover:text-red-400 px-1 hover:bg-red-500/10 rounded transition cursor-pointer"
                                  title="Delete template"
                                >
                                  &times;
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Submit Button - highly prominent, no scroll */}
                      <button
                        type="submit"
                        id="btn-compact"
                        disabled={isCompacting || !journalText.trim()}
                        className="w-full py-3 bg-[#2DD4BF] hover:bg-[#2DD4BF]/90 text-neutral-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                      >
                        {isCompacting ? (
                          <>
                            <motion.div 
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, ease: "linear", duration: 1 }}
                              className="w-3.5 h-3.5 border-2 border-[#2DD4BF] border-t-transparent rounded-full"
                            />
                            Analyzing entry...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Analyze Notes & Suggest Changes
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Suggested Mind Map Changes - DO NOT show until Owner submits */}
                {(isCompacting || stagedReasoning || stagedCards.length > 0) && (
                  <div className="bg-[#141417] border border-[#27272A] rounded-2xl p-5 flex flex-col relative overflow-hidden shadow-2xl justify-between h-[52%] min-h-[300px] animate-fadeIn">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>

                    <div className="space-y-1 mb-3">
                      <div className="flex justify-between items-center">
                        <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                          <Activity className="w-4.5 h-4.5 text-amber-500" />
                          Suggested Mind Map Changes
                        </h2>
                        {stagedCards.length > 0 && (
                          <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 uppercase">
                            {stagedCards.length} Changes Pending
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400">
                        Review and approve the new projects or note additions proposed by the AI helper.
                      </p>
                    </div>

                    {/* AI Working */}
                    {isCompacting && (
                      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 text-xs gap-3 py-14">
                        <motion.div
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        >
                          <Sparkles className="w-8 h-8 text-[#2DD4BF]" />
                        </motion.div>
                        <span>Generating beautiful map suggestions...</span>
                      </div>
                    )}

                    {/* Pending Actions review flow */}
                    {!isCompacting && (stagedReasoning || stagedCards.length > 0) && (
                      <div className="flex-1 flex flex-col justify-between gap-4 overflow-y-auto max-h-[420px] pr-1 py-1">
                        <div className="space-y-3.5">
                          {/* Explanatory summary text */}
                          {stagedReasoning && (
                            <div className="p-3 bg-[#0D0D0F] border border-[#27272A] rounded-xl text-xs leading-relaxed text-[#D4D4D8]">
                              <div className="flex items-center gap-1.5 mb-2 text-[#2DD4BF] font-black uppercase text-[10px]">
                                <Activity className="w-3.5 h-3.5" />
                                Update Summary:
                              </div>
                              <p className="whitespace-pre-line leading-relaxed">{stagedReasoning}</p>
                            </div>
                          )}

                          {/* Proposals list */}
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider pl-1">Suggested Adjustments:</span>
                            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                              {stagedCards.map((card, i) => {
                                const isSecureGate = card.type === "SECURE_GATE_TRIGGERED";
                                const isArchive = card.type === "ARCHIVE_NODE";
                                const typeTranslations: Record<string, string> = {
                                  "ADD_NODE": "New Project Bubble",
                                  "UPDATE_NODE": "Update Project Info",
                                  "ARCHIVE_NODE": "Archive Project Bubble",
                                  "ADD_MEMORY": "New Progress Note",
                                  "SECURE_GATE_TRIGGERED": "Gated Project Security"
                                };
                                const printType = typeTranslations[card.type] || card.type;

                                return (
                                  <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.15, delay: i * 0.04 }}
                                    className={`p-3 border rounded-xl text-xs leading-normal flex items-start gap-3 ${
                                      isSecureGate
                                        ? "bg-pink-955/10 border-pink-500/20 text-pink-200"
                                        : isArchive
                                        ? "bg-[#1C1315] border-red-500/20 text-zinc-400"
                                        : "bg-[#0D0D0F] border-[#27272A] text-zinc-300"
                                    }`}
                                  >
                                    <div className="mt-0.5 shrink-0">
                                      {isSecureGate ? (
                                        <Shield className="w-4 h-4 text-pink-400" />
                                      ) : isArchive ? (
                                        <AlertTriangle className="w-4 h-4 text-red-500" />
                                      ) : (
                                        <CheckCircle className="w-4 h-4 text-[#2DD4BF]" />
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className="font-bold text-zinc-100">{card.title}</span>
                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono uppercase font-semibold ${
                                          isSecureGate ? "bg-pink-900/25 text-pink-400" : "bg-zinc-800 text-zinc-400"
                                        }`}>
                                          {printType}
                                        </span>
                                      </div>
                                      <div className="text-zinc-400 text-[11px] leading-relaxed">
                                        {card.description}
                                      </div>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Commit apply button - highly prominent in plain sight */}
                        {proposedState && (
                          <button
                            id="btn-apply-updates"
                            onClick={handleApplyUpdates}
                            className="w-full mt-2 py-3 bg-[#2DD4BF] hover:bg-[#2DD4BF]/90 text-neutral-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-teal-500/10 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Approve & Apply Suggestions
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Interactive Node Map and Project Notes under it */}
              <div className="flex flex-col gap-6 w-full">
                {/* Interactive Node Map */}
                <div className="flex flex-col bg-[#141417] border border-[#27272A] rounded-2xl p-5 relative overflow-hidden shadow-2xl h-[480px]">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-[#2DD4BF]"></div>
                  
                  <div className="flex items-center justify-between gap-4 mb-4 border-b border-[#27272A]/40 pb-3 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap min-w-0">
                      {unlockedProfileHandles.map((handle, idx) => {
                        const p = PROFILES.find(prof => prof.handle.toLowerCase() === handle.toLowerCase());
                        if (!p) return null;
                        const isActive = p.handle === activeProfileHandle;
                        return (
                          <Fragment key={p.handle}>
                            {idx > 0 && <div className="h-8 w-px bg-[#27272A] shrink-0 self-center"></div>}
                            
                            <div 
                              onClick={() => {
                                handleSwitchProfile(p.handle);
                                setSelectedNodeId(null);
                              }}
                              className={`flex items-center gap-3 p-2 rounded-xl text-left cursor-pointer transition select-none group shrink-0 border relative ${
                                isActive 
                                  ? 'bg-[#1C1C21]/90 border-[#2DD4BF]/60 text-zinc-100 shadow-md' 
                                  : 'bg-[#1A1A1E]/80 border-[#27272A]/80 hover:bg-[#202025] hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
                              }`}
                              title={`Switch active context to ${p.name}`}
                            >
                              <img 
                                src={p.photoUrl} 
                                alt={p.name}
                                className={`w-8 h-8 rounded-full object-cover shrink-0 border ${
                                  isActive ? 'border-[#2DD4BF]/45' : 'border-zinc-800'
                                }`}
                                referrerPolicy="no-referrer"
                              />
                              <div className="min-w-0 font-sans text-left">
                                <h4 className={`font-bold text-xs leading-tight transition ${
                                  isActive ? 'text-[#2DD4BF]' : 'text-zinc-300 group-hover:text-zinc-100'
                                }`}>{p.name}</h4>
                                <p className="text-[9.5px] text-zinc-400 mt-0.5 max-w-[140px] sm:max-w-[200px] font-normal leading-tight truncate">{p.title}</p>
                                <span className={`text-[9px] font-mono block font-medium mt-0.5 leading-none transition ${
                                  isActive ? 'text-[#2DD4BF]' : 'text-zinc-500 group-hover:text-[#2dd4bf]'
                                }`}>{p.handle}</span>
                              </div>

                              {/* Revert back close button if there is more than 1 unlocked profile and this isn't the session root profile */}
                              {unlockedProfileHandles.length > 1 && idx > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCloseProfile(p.handle);
                                  }}
                                  className="p-1 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-500/15 transition shrink-0 ml-1.5 self-start"
                                  title="Close Profile map"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </Fragment>
                        );
                      })}
                    </div>
                  </div>

                  {unlockedTokens.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-[#0D0D0F] border border-[#27272A] rounded-xl mb-4">
                      <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1">
                        <Unlock className="w-3 h-3 text-emerald-400" />
                        Unlocked Secrets:
                      </span>
                      {unlockedTokens.map((tok, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-[#2DD4BF] flex items-center gap-1.5 hover:bg-zinc-800 transition cursor-pointer"
                          title="Click to lock project"
                          onClick={() => removeVaultToken(tok)}
                        >
                          <Hash className="w-2.5 h-2.5 text-emerald-500" />
                          {tok}
                          <span className="text-red-400 hover:text-red-300 transition ml-1">&times;</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Canvas Area wrapper */}
                  <div className="flex-grow min-h-0 relative">


                    {showOnboarding ? (
                      <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 bg-[#0D0D0F] border border-dashed border-[#27272A]/70 rounded-xl font-mono gap-3 min-h-[300px]">
                        <Lock className="w-8 h-8 text-pink-500 animate-pulse" />
                        <div className="text-zinc-200 text-sm font-bold uppercase tracking-widest">MAP LOCKED</div>
                        <p className="text-[11px] text-zinc-500 max-w-xs font-sans leading-normal">
                          Your interactive personal knowledge graph is hidden to protect privacy due to system inactivity/standby. Close the security overlay to resume.
                        </p>
                      </div>
                    ) : (
                      <>
                         <KnowledgeGraphCanvas
                          nodes={mergedNodes}
                          edges={mergedEdges}
                          selectedNodeId={selectedNodeId}
                          unlockedTokens={unlockedTokens}
                          onSelectNode={(id) => {
                            const nextId = id === selectedNodeId ? null : id;
                            setSelectedNodeId(nextId);
                            if (nextId) {
                              const node = graphState?.activeNodes?.find(n => n.id === nextId);
                              if (node) {
                                let details = `Modify project "${node.label}" (#${node.id}):\nSummary: ${node.summary}`;
                                const memoriesOfNode = (graphState?.memories || []).filter(m => m.node_id === node.id);
                                if (memoriesOfNode.length > 0) {
                                  details += `\n\nExisting Notes:\n` + memoriesOfNode.map(m => `- ${m.content}`).join("\n");
                                }
                                setJournalText(details);
                              }
                            } else {
                              setJournalText("");
                            }
                          }}
                          activeViewId={activeViewId}
                          nodePositions={currentNodePositions}
                          onStartDragging={(positions) => {
                            if (activeViewId !== "dirty") {
                              setActiveViewId("dirty");
                              setCurrentNodePositions(positions);
                            }
                          }}
                          onNodeDragged={(positions) => {
                            setCurrentNodePositions(positions);
                          }}
                          activeDoppelgangerId={activeProfileHandle}
                          resetTrigger={viewResetTrigger}
                        />
                        <div className="absolute bottom-4 left-4 z-20 flex flex-wrap gap-2 items-center pointer-events-auto">
                          <button
                            id="btn-owner-view-default"
                            type="button"
                            onClick={() => {
                              setActiveViewId("default");
                              setCurrentNodePositions(null);
                              setViewResetTrigger((prev) => prev + 1);
                            }}
                            className={`px-3 py-1.5 rounded-lg border text-[10px] font-mono tracking-wider backdrop-blur-sm transition-all uppercase font-bold cursor-pointer ${
                              activeViewId === "default"
                                ? "bg-[#2DD4BF]/20 border-[#2DD4BF] text-[#2DD4BF] shadow-lg shadow-[#2DD4BF]/10"
                                : "bg-[#16161B]/80 border-[#27272A] text-zinc-400 hover:text-zinc-200 hover:bg-[#202025]/90"
                            }`}
                          >
                            DEFAULT VIEW
                          </button>

                          {savedViews.map((view) => (
                            <div key={view.id} className="flex items-center gap-1 bg-[#16161B]/80 hover:bg-[#16161B]/95 border border-[#27272A] rounded-lg p-0.5 backdrop-blur-sm transition-all shadow">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveViewId(view.id);
                                  setCurrentNodePositions(view.nodePositions);
                                }}
                                className={`px-2 py-1 text-[10px] font-mono tracking-wider rounded transition-all uppercase ${
                                  activeViewId === view.id
                                    ? "text-[#2DD4BF] font-bold"
                                    : "text-zinc-400 hover:text-zinc-200"
                                }`}
                              >
                                {view.name}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewToDelete({ id: view.id, name: view.name });
                                }}
                                className="px-1 text-zinc-500 hover:text-red-400 transition cursor-pointer font-bold leading-none text-xs"
                                title="Delete saved view"
                              >
                                ×
                              </button>
                            </div>
                          ))}

                          {activeViewId === "dirty" && (
                            <button
                              id="btn-owner-save-view"
                              type="button"
                              onClick={() => {
                                setShowSaveViewModal(true);
                              }}
                              className="px-3 py-1.5 rounded-lg border border-[#2DD4BF] bg-[#2DD4BF]/10 text-[#2DD4BF] text-[10px] font-mono tracking-wider backdrop-blur-sm hover:bg-[#2DD4BF]/25 transition active:scale-95 cursor-pointer font-bold animate-fadeIn"
                            >
                              SAVE VIEW
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Project Notes Section (Selection Details Box) */}
                {selectedNodeObj && (
                  <div className="bg-[#141417] border border-[#27272A] rounded-2xl p-5 flex flex-col min-h-[220px] max-h-[300px] overflow-y-auto shadow-xl relative animate-fadeIn min-w-0">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <div className="space-y-4 font-sans text-xs w-full">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-semibold text-[#2DD4BF] uppercase tracking-wider font-mono">Project Note</span>
                        {(selectedNodeObj.isIsolated || selectedNodeObj.visibility_status === "isolated_passphrase") && (
                          hasAccessToSelected ? (
                            <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-[#2DD4BF] px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                              <Unlock className="w-2.5 h-2.5" /> Unlocked
                            </span>
                          ) : (
                            <span className="text-[9px] bg-pink-500/10 border border-pink-500/20 text-pink-400 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono animate-pulse">
                              <Lock className="w-2.5 h-2.5" /> Locked
                            </span>
                          )
                        )}
                      </div>

                      {!hasAccessToSelected ? (
                        <div className="bg-[#1A1A1E] border border-[#27272A]/80 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 font-mono">
                          <Lock className="w-6 h-6 text-pink-400 animate-pulse" />
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-pink-400 uppercase tracking-widest font-mono">PRIVATE:</span>
                            <button
                              type="button"
                              onClick={() => {
                                setPasscodeNodeToUnlock(selectedNodeObj);
                                setLocalPasscodeInput("");
                                setPasscodeError("");
                              }}
                              className="px-3 py-1 bg-pink-500/15 hover:bg-pink-500/25 text-pink-400 font-bold uppercase text-[10px] tracking-wider border border-pink-500/30 rounded-lg cursor-pointer transition select-none"
                            >
                              [Unlock]
                            </button>
                          </div>
                          <p className="text-[11px] text-zinc-400 max-w-xs leading-normal font-sans">
                            This project is private. Click [Unlock] to enter the passcode and unlock access.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4">
                          <div>
                            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 font-mono">Title</h4>
                            <h3 className="text-sm font-bold text-zinc-100">{selectedNodeObj.label}</h3>
                          </div>

                          <div>
                            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 font-mono">Summary</h4>
                            <p className="text-zinc-300 leading-relaxed font-normal bg-[#1C1C21]/40 p-2.5 rounded-xl border border-zinc-800/40">
                              {selectedNodeObj.summary}
                            </p>
                          </div>

                          <div>
                            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 font-mono">Details</h4>
                            <p className="text-zinc-350 leading-relaxed font-normal bg-[#1C1C21]/40 p-2.5 rounded-xl border border-zinc-800/40 whitespace-pre-wrap">
                              {nodeDetails.decText}
                            </p>
                          </div>

                           <div>
                            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 font-mono">Created</h4>
                            <p className="text-zinc-400 font-medium font-mono">{nodeDetails.created}</p>
                          </div>

                          <div className="pt-1 flex justify-start items-center">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveView('visitor');
                                handleVisitorQuery(undefined, nodeDetails.query);
                              }}
                              className="text-[#2DD4BF] hover:underline transition font-medium flex items-center gap-1 cursor-pointer bg-[#2DD4BF]/5 border border-[#2DD4BF]/15 hover:bg-[#2DD4BF]/10 px-3 py-1.5 rounded-xl font-mono text-[11px]"
                            >
                              Ask about this &rarr;
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            /* Admin Console (JSON Database Editor) */
            <motion.div
              key="admin-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1 min-h-[500px]"
            >
              {/* Left Column: Editor Textarea - spans 8 cols */}
              <div className="lg:col-span-8 flex flex-col bg-[#141417] border border-[#27272A] rounded-2xl p-5 relative overflow-hidden shadow-2xl h-[600px] xl:h-[calc(100vh-210px)] min-h-[500px]">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#2DD4BF]"></div>
                
                <div className="flex items-center justify-between mb-4 border-b border-[#27272A]/40 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-zinc-100 flex items-center gap-1.5 uppercase font-mono">
                      <Database className="w-4 h-4 text-[#2DD4BF]" />
                      Mental Map State Editor (JSON)
                    </h2>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Edit the raw JSON blueprint of the current active mind map. Format is strictly verified upon save.</p>
                  </div>
                  <div className="text-[10px] bg-[#1C1C21] border border-zinc-805 px-3 py-1 rounded-lg text-zinc-400 font-mono">
                    SIZE: <span className="text-[#2DD4BF] font-bold">{adminJsonText.length} bytes</span>
                  </div>
                </div>

                {/* Raw JSON Code Field */}
                <div className="relative flex-1 bg-[#09090B] border border-zinc-850/80 rounded-xl overflow-hidden flex flex-col">
                  <textarea
                    value={adminJsonText}
                    onChange={(e) => setAdminJsonText(e.target.value)}
                    spellCheck={false}
                    className="flex-1 w-full h-full bg-transparent text-zinc-300 font-mono text-[11px] leading-relaxed p-4 border-none focus:outline-none focus:ring-0 overflow-y-auto whitespace-pre resize-none scrollbar-thin"
                    placeholder="Load a profile or start pasting your graph JSON..."
                  />
                </div>

                {/* Error Status Display */}
                {adminJsonError && (
                  <div className="mt-4 p-3 bg-red-950/20 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-xs text-red-400 font-mono animate-fadeIn">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1 leading-normal">
                      <div className="font-bold uppercase tracking-wider text-[10px] text-red-400">Syntax Verification Failed:</div>
                      <p className="mt-0.5 text-zinc-355">{adminJsonError}</p>
                    </div>
                  </div>
                )}

                {adminJsonSuccess && (
                  <div className="mt-4 p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs text-emerald-400 font-mono animate-fadeIn">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Database changes successfully applied & saved to active profile!</span>
                  </div>
                )}
              </div>

              {/* Right Column: Schema Control Deck - spans 4 cols */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                
                {/* Save Deck Card */}
                <div className="bg-[#141417] border border-[#27272A] rounded-2xl p-5 relative overflow-hidden shadow-2xl flex flex-col justify-between">
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#2DD4BF]"></div>
                  
                  <div className="space-y-3.5">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono">Operations Console</h3>
                    
                    {/* Active Doppelganger Indicator */}
                    <div className="p-3 bg-zinc-900/60 border border-zinc-850 rounded-xl flex items-center gap-3">
                      <img src={ownerPhotoUrl} className="w-9 h-9 rounded-full object-cover border border-zinc-800" referrerPolicy="no-referrer" />
                      <div className="truncate flex flex-col min-w-0">
                        <span className="font-mono text-xs font-bold text-zinc-200">{activeProfileHandle}</span>
                        <span className="text-[10px] text-zinc-500 truncate">{ownerName} &bull; {ownerTitle}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveAdminJson}
                      className={`w-full py-2.5 rounded-xl text-center text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer font-sans shadow-lg flex items-center justify-center gap-2 ${
                        adminJsonError
                          ? "bg-red-950/20 border-red-500/30 text-red-400 hover:bg-red-500/10"
                          : adminJsonSuccess
                          ? "bg-emerald-500 text-neutral-950 border-emerald-400"
                          : "bg-[#2DD4BF] text-neutral-950 hover:bg-[#20bda9] border-[#2DD4BF]"
                      }`}
                    >
                      <Database className="w-4 h-4" />
                      Save & Apply Modifications
                    </button>
                  </div>
                </div>

                {/* Profile Hot-Swapper Direct Deck */}
                <div className="bg-[#141417] border border-[#27272A] rounded-2xl p-5 relative overflow-hidden shadow-2xl space-y-3">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono">Context Profile Switcher</h3>
                  <div className="flex flex-col gap-2">
                    {visibleSwitcherProfiles.map((prof) => (
                      <button
                        key={prof.handle}
                        type="button"
                        onClick={() => handleSwitchProfile(prof.handle)}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition flex items-center gap-3 min-w-0 ${
                          activeProfileHandle === prof.handle
                            ? "bg-[#2DD4BF]/5 border-[#2DD4BF] text-[#2DD4BF]"
                            : "bg-[#1C1C21] border-zinc-850 hover:border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        <img src={prof.photoUrl} className="w-7 h-7 rounded-full object-cover" referrerPolicy="no-referrer" />
                        <div className="truncate flex flex-col min-w-0">
                          <span className="font-mono text-xs font-bold">{prof.handle}</span>
                          <span className="text-[10px] text-zinc-500 leading-tight">{prof.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Database Schema Guide */}
                <div className="bg-[#141417] border border-[#27272A]/80 rounded-2xl p-5 relative overflow-hidden shadow-2xl flex-1 text-xs">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono mb-3">Schema Instructions</h3>
                  <div className="space-y-3 text-zinc-400 leading-normal font-sans">
                    <p>
                      Each mind map conforms to a <span className="text-[#2DD4BF] font-semibold">StateBlueprint</span> JSON blueprint specification:
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-zinc-500">
                      <li>
                        <strong className="text-zinc-300 font-semibold font-mono">activeNodes:</strong> Array specifying each node's configuration parameters.
                      </li>
                      <li>
                        <strong className="text-zinc-300 font-semibold font-mono">weight:</strong> Hub sizing level (3.0 = Parent, 2.0 = Child, 1.0 = Grandchild).
                      </li>
                      <li>
                        <strong className="text-zinc-300 font-semibold font-mono">isIsolated:</strong> Gated private nodes requiring passphrases.
                      </li>
                      <li>
                        <strong className="text-zinc-300 font-semibold font-mono">edges:</strong> Interconnecting path relationships describing source & target pairings.
                      </li>
                      <li>
                        <strong className="text-zinc-300 font-semibold font-mono">memories:</strong> Ingested background detailed notes mapping to target node IDs.
                      </li>
                    </ul>
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Styled Footer Metrics Bar - Simplified, de-nerded metrics */}
      <footer className="h-[65px] border-t border-[#27272A] flex items-center justify-between px-8 bg-[#141417]/85 text-[11px] text-zinc-500 max-sm:px-4 max-sm:flex-col max-sm:h-auto max-sm:py-3.5 max-sm:gap-2 shrink-0">
        
        {/* Left: View mode toggles shifted to the footer */}
        <div className={`flex items-center gap-2.5 transition-all duration-300 ${isScreensaverActive ? "opacity-0 pointer-events-none select-none" : ""}`}>
          <div className="flex bg-[#18181B] border border-[#27272A] p-0.5 rounded-xl">
            <button
               id="tab-visitor"
               onClick={() => {
                 setActiveView('visitor');
                 setShowSuggestions(false);
               }}
               className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                 activeView === 'visitor'
                   ? 'bg-[#27272A] text-[#2DD4BF] shadow-lg shadow-black/40'
                   : 'text-zinc-400 hover:text-zinc-200'
               }`}
            >
              <User className="w-3.5 h-3.5" />
              Visitor View
            </button>
            <button
               id="tab-owner"
               onClick={() => {
                 setActiveView('owner');
                 setShowSuggestions(false);
               }}
               className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                 activeView === 'owner'
                   ? 'bg-[#27272A] text-[#2DD4BF] shadow-lg shadow-black/40'
                   : 'text-zinc-400 hover:text-zinc-200'
               }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Owner Console
            </button>
            <button
               id="tab-admin"
               onClick={() => {
                 setActiveView('admin');
                 setShowSuggestions(false);
               }}
               className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                 activeView === 'admin'
                   ? 'bg-[#27272A] text-[#2DD4BF] shadow-lg shadow-black/40'
                   : 'text-zinc-400 hover:text-zinc-200'
               }`}
            >
              <Database className="w-3.5 h-3.5" />
              Database Editor
            </button>
          </div>
        </div>

        {/* Right footer cluster */}
        <div className="flex gap-4 items-center font-sans text-xs">
          
          <button 
            id="btn-bootstrap"
            onClick={bootstrapLocalGraph}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#18181B] hover:bg-[#202025] text-[#2DD4BF] font-semibold font-mono text-[10px] uppercase tracking-wider rounded-lg border border-[#27272A] hover:border-[#2DD4BF]/40 transition active:scale-95 cursor-pointer shadow-lg outline-none"
          >
            <span>Load Sample Projects</span>
          </button>

        </div>
      </footer>

      {/* Onboarding Overlay (Node View Explanation Modal) */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 top-[180px] md:top-[80px] z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-hidden"
          >
            {/* Ambient parent-child-grandchild node map animation */}
            <OnboardingBackground />

            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-[#141417] border border-[#27272A] rounded-2xl max-w-md w-full p-6 shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#2DD4BF] to-purple-500"></div>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-[#2DD4BF]/10 rounded-xl text-[#2DD4BF] border border-[#2DD4BF]/20">
                  <Activity className="w-5 h-5 animate-pulse" />
                </div>
                <h3 className="text-lg font-bold text-zinc-100 tracking-tight">Interactive Map</h3>
              </div>
              
              <div className="space-y-4 text-xs text-zinc-350 leading-relaxed mb-6 font-sans">
                <p>
                  Explore projects and ideas. Click any node to view detailed background notes and load dynamic chatbot retrieval contexts.
                </p>
                <div className="p-3 bg-[#0D0D0F] border border-zinc-850 rounded-xl space-y-2">
                  <div className="flex gap-2.5 items-start">
                    <span className="text-[#2DD4BF] font-mono mt-0.5 font-bold">&bull;</span>
                    <span><strong>Click Nodes</strong> to retrieve related text memory segments, contextual background, and prompt suggestions.</span>
                  </div>
                  <div className="flex gap-2.5 items-start">
                    <span className="text-[#2DD4BF] font-mono mt-0.5 font-bold">&bull;</span>
                    <span>Use the <strong>Universal Search Bar</strong> in the top header to query <strong>@username</strong> to swap user Doppelgängers or <strong>#keywords</strong> to view project node indexes.</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-zinc-900 pt-4">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-zinc-400 group">
                  <input 
                    type="checkbox"
                    checked={dontRemindMe}
                    onChange={(e) => setDontRemindMe(e.target.checked)}
                    className="rounded border-[#27272A] bg-zinc-900 text-[#2DD4BF] focus:focus:ring-[#2DD4BF]/40 h-4 w-4 transition cursor-pointer"
                  />
                  <span className="group-hover:text-zinc-200 transition">Don't remind me</span>
                </label>

                <button
                  type="button"
                  onClick={handleCloseOnboarding}
                  className="w-full sm:w-auto px-5 py-2 bg-[#2DD4BF] hover:bg-[#26b4a2] active:scale-95 text-neutral-900 font-bold uppercase text-[10px] tracking-wider rounded-xl transition cursor-pointer shadow-lg outline-none"
                >
                  Continue
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Panel Backdrop Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#141417] border border-[#27272A] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative"
            >
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 cursor-pointer p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-2 mb-4 border-b border-zinc-900 pb-3">
                <Settings className="w-5 h-5 text-[#2DD4BF]" />
                <h3 className="text-base font-bold text-zinc-100 uppercase tracking-wider">Settings</h3>
              </div>

              <div className="space-y-4 text-xs">
                
                {/* Profile Hot-Swapping Panel inside settings */}
                <div className="p-3 bg-[#0D0D0F] border border-[#27272A] rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Active Doppelgänger (Neural Profile Swap)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    {visibleSwitcherProfiles.map(prof => (
                      <button
                        key={prof.handle}
                        type="button"
                        onClick={() => {
                          handleSwitchProfile(prof.handle);
                          setShowSettingsModal(false);
                        }}
                        className={`p-2 rounded-lg border text-left cursor-pointer transition flex items-center gap-2 min-w-0 ${
                          activeProfileHandle === prof.handle
                            ? "bg-[#2DD4BF]/5 border-[#2DD4BF] text-[#2DD4BF]"
                            : "bg-[#141417] border-zinc-850 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                        }`}
                      >
                        <img src={prof.photoUrl} className="w-6 h-6 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                        <div className="truncate flex flex-col min-w-0">
                          <span className="font-mono text-[9.5px] font-bold truncate">{prof.handle}</span>
                          <span className="text-[8.5px] truncate text-zinc-500 leading-none">{prof.name.split(" ")[0]}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Screensaver Activation Delay & Inactivity Controls */}
                <div className="p-3 bg-[#0D0D0F] border border-[#27272A] rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block font-mono">Screensaver Inactivity Delay</span>
                    <span className="text-[9.5px] font-mono text-[#2DD4BF] bg-[#2DD4BF]/5 border border-[#2DD4BF]/15 px-2 py-0.5 rounded-md">
                      {inactivityTimeout === 0 ? "DISABLED" : `${inactivityTimeout} MIN`}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-normal font-sans">
                    Fades in a beautiful animated node screensaver after a period of overall user inactivity.
                  </p>
                  <div className="flex gap-1.5 pt-1">
                    {[0, 1, 2, 5, 10].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setInactivityTimeout(t);
                          localStorage.setItem("doppelganger_screensaver_timeout_mins", String(t));
                        }}
                        className={`flex-1 py-1 rounded-md text-[9.5px] font-mono font-bold border transition-all cursor-pointer ${
                          inactivityTimeout === t
                            ? "bg-[#2DD4BF] border-[#2DD4BF] text-neutral-900 shadow-md"
                            : "bg-[#141417] border-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {t === 0 ? "OFF" : `${t} MIN`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* DB System Import & Export Control Deck */}
                <div className="p-3 bg-[#0D0D0F] border border-[#27272A] rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block font-mono">Export / Import System JSON Data</span>
                  <p className="text-[10px] text-zinc-500 leading-normal font-sans">
                    Backup or restore full dataset state including user profiles, nodes, edges, and contextual user memory notes.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allProfilesDict, null, 2));
                          const downloadAnchor = document.createElement('a');
                          downloadAnchor.setAttribute("href", dataStr);
                          downloadAnchor.setAttribute("download", "doppelganger_profiles_and_nodes_database.json");
                          document.body.appendChild(downloadAnchor);
                          downloadAnchor.click();
                          downloadAnchor.remove();
                        } catch (err: any) {
                          alert(`Export error: ${err.message}`);
                        }
                      }}
                      className="py-1.5 px-3 bg-[#141417] border border-zinc-800 hover:border-[#2DD4BF]/40 text-[#2DD4BF] hover:bg-[#2DD4BF]/5 text-[9px] font-bold font-mono uppercase tracking-wider rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export JSON Table
                    </button>

                    <label
                      className="py-1.5 px-3 bg-[#141417] border border-zinc-800 hover:border-[#2DD4BF]/40 text-zinc-300 hover:bg-zinc-800 text-[9px] font-bold font-mono uppercase tracking-wider rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer text-center select-none shadow-md"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#2DD4BF]" />
                      <span>Import JSON Dataset</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            try {
                              const text = event.target?.result as string;
                              const parsed = JSON.parse(text);
                              
                              if (typeof parsed !== "object" || parsed === null) {
                                throw new Error("Dataset blueprint must be a valid JSON object map.");
                              }
                              
                              const keys = Object.keys(parsed);
                              if (keys.length === 0) {
                                throw new Error("JSON file must contain at least one valid profile key starting with @.");
                              }
                              
                              keys.forEach((key) => {
                                if (!key.startsWith("@")) {
                                  throw new Error("Invalid user profile key syntax. Must start with @ symbol.");
                                }
                                const val = parsed[key];
                                if (!val.activeNodes || !Array.isArray(val.activeNodes)) {
                                  throw new Error(`Profile '${key}' lacks activeNodes definition list.`);
                                }
                              });

                              setAllProfilesDict(parsed);
                              alert(`Successfully restored ${keys.length} Doppelgänger user profiles and node maps!`);
                            } catch (err: any) {
                              alert(`Import failed: ${err.message}`);
                            }
                          };
                          reader.readAsText(file);
                          e.target.value = "";
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* State reset setting button & Onboarding reminder reset toggle */}
                <div className="flex flex-col sm:flex-row gap-3 items-stretch justify-between">
                  <div className="flex-1 p-3 bg-[#0D0D0F]/70 border border-[#27272A]/80 rounded-xl flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-zinc-400 uppercase font-mono block">Reset Onboarding Prompts</span>
                      <p className="text-[10px] text-zinc-500 mt-1 leading-normal font-sans">Forces the interactive node graph onboarding overlays to show up again.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.removeItem(`doppelganger_overlay_dismissed_v3_${activeProfileHandle}`);
                        sessionStorage.removeItem("doppelganger_onboarding_session_shown");
                        setDontRemindMe(false);
                        setShowOnboarding(true);
                        setShowSettingsModal(false);
                        alert(`Onboarding prompt reset successfully for ${activeProfileHandle}!`);
                      }}
                      className="mt-3 w-full py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-bold uppercase text-[9px] tracking-wider rounded-lg transition cursor-pointer text-center font-sans"
                    >
                      Reset Overlay Now
                    </button>
                  </div>

                  <div className="flex-1 p-3 bg-[#0D0D0F]/70 border border-[#27272A]/80 rounded-xl flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-zinc-400 uppercase font-mono block">Factory Erase Cache</span>
                      <p className="text-[10px] text-zinc-500 mt-1 leading-normal font-sans">Hard resets all profiles back to original mock templates and erases localstorage.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.clear();
                        sessionStorage.removeItem("doppelganger_onboarding_session_shown");
                        setUnlockedTokens([]);
                        setAllProfilesDict({
                          "@chris.adkins": DEFAULT_MOCK_STATE,
                          "@alex.morgan": ALEX_MOCK_STATE,
                          "@jordan.lee": JORDAN_MOCK_STATE
                        });
                        setActiveProfileHandle("@chris.adkins");
                        setSearchVal("");
                        setDontRemindMe(false);
                        setShowOnboarding(true);
                        setShowSettingsModal(false);
                        alert("Workspace caches factory-erased fully!");
                      }}
                      className="mt-3 w-full py-1.5 bg-red-950/20 border border-red-500/20 hover:bg-red-500/15 text-red-400 font-bold uppercase text-[9px] tracking-wider rounded-lg transition cursor-pointer text-center font-sans"
                    >
                      Factory Hard Reset
                    </button>
                  </div>
                </div>

              </div>

              <div className="mt-5 border-t border-zinc-900 pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-1.5 bg-zinc-805 hover:bg-zinc-700 text-zinc-200 text-[10px] font-bold uppercase tracking-wider rounded-lg cursor-pointer"
                >
                  Save Settings
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Project Passcode Unlock Modal Overlay */}
      <AnimatePresence>
        {passcodeNodeToUnlock && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fadeIn"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#141417] border border-[#27272A] rounded-2xl max-w-sm w-full p-6 shadow-2xl relative"
            >
              <button
                type="button"
                onClick={() => {
                  setPasscodeNodeToUnlock(null);
                  setLocalPasscodeInput("");
                  setPasscodeError("");
                }}
                className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 cursor-pointer p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 mb-4 border-b border-zinc-900 pb-3">
                <Lock className="w-5 h-5 text-pink-500" />
                <h3 className="text-base font-bold text-zinc-100 font-mono tracking-wide uppercase">Unlock Private Project</h3>
              </div>

              <div className="space-y-4">
                <div className="text-center py-2">
                  <span className="text-[11px] font-semibold text-zinc-400">Unlock project records for:</span>
                  <div className="text-sm font-bold text-pink-400 mt-1">{passcodeNodeToUnlock.label}</div>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!localPasscodeInput.trim()) return;
                    const code = localPasscodeInput.toUpperCase().trim();

                    // Check if code matches node accessKeyHash / access_key_hash across any profile or current profile
                    const validKey = (passcodeNodeToUnlock.access_key_hash || passcodeNodeToUnlock.accessKeyHash || "").toUpperCase().trim();
                    
                    if (validKey === code) {
                      if (!unlockedTokens.includes(code)) {
                        setUnlockedTokens(prev => [...prev, code]);
                        setChatMessages(prev => [
                          ...prev,
                          {
                            id: `unlock-${Date.now()}`,
                            sender: "doug",
                            text: `🔑 Code accepted! Under-development project '${passcodeNodeToUnlock.label}' is now fully unlocked and integrated into the map scene.`,
                            timestamp: new Date().toLocaleTimeString()
                          }
                        ]);
                      }
                      setPasscodeNodeToUnlock(null);
                      setLocalPasscodeInput("");
                      setPasscodeError("");
                    } else {
                      setPasscodeError(`Invalid passcode key! Key is not applicable to the "${passcodeNodeToUnlock.label}" node.`);
                    }
                  }}
                  className="space-y-3"
                >
                  <div className="space-y-1">
                    <label htmlFor="modal-passcode-input" className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 font-mono block">
                      Project Passcode
                    </label>
                    <input
                      id="modal-passcode-input"
                      type="text"
                      required
                      value={localPasscodeInput}
                      onChange={(e) => {
                        setLocalPasscodeInput(e.target.value);
                        setPasscodeError("");
                      }}
                      placeholder="Enter project passcode..."
                      className="w-full bg-[#0D0D0F] border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-pink-300 placeholder-zinc-700 focus:outline-none focus:border-pink-500/50 transition font-mono"
                    />
                  </div>

                  {passcodeError && (
                    <div className="text-xs text-red-500 bg-red-950/20 border border-red-500/20 px-3 py-2 rounded-xl flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                      <span>{passcodeError}</span>
                    </div>
                  )}

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPasscodeNodeToUnlock(null);
                        setLocalPasscodeInput("");
                        setPasscodeError("");
                      }}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-bold uppercase rounded-xl transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-pink-600 hover:bg-pink-500 active:scale-95 text-white text-xs font-bold uppercase rounded-xl transition cursor-pointer shadow-lg shadow-pink-650/40"
                    >
                      Unlock Access
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save View Modal */}
      <AnimatePresence>
        {showSaveViewModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#141417] border border-[#27272A] rounded-2xl max-w-sm w-full p-6 shadow-2xl relative"
            >
              <button
                type="button"
                onClick={() => {
                  setShowSaveViewModal(false);
                  setNewViewName("");
                }}
                className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 cursor-pointer p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 mb-4 border-b border-zinc-900 pb-3">
                <Save className="w-5 h-5 text-[#2DD4BF]" />
                <h3 className="text-base font-bold text-zinc-100 font-mono tracking-wide uppercase">Save Node View</h3>
              </div>

              <div className="space-y-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newViewName.trim() || !currentNodePositions) return;
                    const id = `view-${Date.now()}`;
                    const updatedViews = [
                      ...savedViews,
                      { id, name: newViewName.trim(), nodePositions: currentNodePositions }
                    ];
                    saveViewsForProfile(updatedViews);
                    setActiveViewId(id);
                    setShowSaveViewModal(false);
                    setNewViewName("");
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1">
                    <label htmlFor="modal-view-name" className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 font-mono block">
                      View Name
                    </label>
                    <input
                      id="modal-view-name"
                      type="text"
                      required
                      value={newViewName}
                      onChange={(e) => setNewViewName(e.target.value)}
                      placeholder="e.g. My Custom Layout, Quadrant View..."
                      className="w-full bg-[#0D0D0F] border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-[#2DD4BF] placeholder-zinc-700 focus:outline-none focus:border-[#2DD4BF]/50 transition font-mono"
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowSaveViewModal(false);
                        setNewViewName("");
                      }}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-bold uppercase rounded-xl transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#2DD4BF] hover:bg-[#2DD4BF]/80 text-black text-xs font-bold uppercase rounded-xl transition cursor-pointer shadow-lg shadow-[#2DD4BF]/20"
                    >
                      Save View
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Saved View Confirmation Modal */}
      <AnimatePresence>
        {viewToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#141417] border border-[#27272A] rounded-2xl max-w-sm w-full p-6 shadow-2xl relative"
            >
              <button
                type="button"
                onClick={() => setViewToDelete(null)}
                className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 cursor-pointer p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 mb-4 border-b border-zinc-900 pb-3">
                <Trash2 className="w-5 h-5 text-red-500" />
                <h3 className="text-base font-bold text-zinc-100 font-mono tracking-wide uppercase">Delete Custom View</h3>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-zinc-400 font-sans leading-normal">
                  Are you sure you want to delete the saved view <strong className="text-[#2DD4BF]">"{viewToDelete.name}"</strong>? This layout coordinate configuration will be permanently discarded.
                </p>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setViewToDelete(null)}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-bold uppercase rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const updatedViews = savedViews.filter((v) => v.id !== viewToDelete.id);
                      saveViewsForProfile(updatedViews);
                      if (activeViewId === viewToDelete.id) {
                        setActiveViewId("default");
                        setCurrentNodePositions(null);
                        setViewResetTrigger((prev) => prev + 1);
                      }
                      setViewToDelete(null);
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase rounded-xl transition cursor-pointer shadow-lg shadow-red-650/30"
                  >
                    Delete View
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
