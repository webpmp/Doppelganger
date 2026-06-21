import React, { useState, useMemo } from "react";
import { ActiveNode, Edge, stripLabelNumbering, classifyNodeLevel, formatNodeLabel } from "../types";
import { 
  Folder, 
  Layers, 
  FileText, 
  Unlock, 
  Lock, 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Info, 
  Check, 
  Edit3,
  Flame,
  Globe,
  Settings
} from "lucide-react";

interface StructuralOutlineProps {
  nodes: ActiveNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  unlockedTokens: string[];
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

export const StructuralOutline: React.FC<StructuralOutlineProps> = ({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  unlockedTokens,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Build high-affinity parent-child relationships using edges + ID prefixes as fallbacks
  const hierarchyTree = useMemo(() => {
    const level1 = nodes.filter(n => getNodeLevel(n) === 1);
    const level2 = nodes.filter(n => getNodeLevel(n) === 2);
    const level3 = nodes.filter(n => getNodeLevel(n) !== 1 && getNodeLevel(n) !== 2);

    // Maps to track relations
    const level2Parents = new Map<string, string>(); // Level 2 ID -> Level 1 ID
    const level3Parents = new Map<string, string>(); // Level 3 ID -> Level 2 ID

    // Build map from edges
    edges.forEach(edge => {
      const src = edge.source;
      const tgt = edge.target;

      // Check if source is L2 and target is L1
      const isSrcL2 = level2.some(n => n.id === src);
      const isTgtL1 = level1.some(n => n.id === tgt);
      if (isSrcL2 && isTgtL1) {
        level2Parents.set(src, tgt);
      }

      // Check if source is L3 and target is L2
      const isSrcL3 = level3.some(n => n.id === src);
      const isTgtL2 = level2.some(n => n.id === tgt);
      if (isSrcL3 && isTgtL2) {
        level3Parents.set(src, tgt);
      }
    });

    // Sub-items grouping
    const tree = level1.map(pN => {
      // Find children (Level 2)
      const children = level2.filter(cN => {
        // Explicit edge match
        if (level2Parents.get(cN.id) === pN.id) return true;
        // Fallback: ID prefix correlation
        const pNum = pN.id.replace("node-", "").replace(".0", "");
        const cNum = cN.id.replace("node-", "");
        return cNum.startsWith(pNum) && cNum !== pNum;
      }).map(cN => {
        // Find grandchildren (Level 3)
        const grandchildren = level3.filter(gN => {
          // Explicit edge match
          if (level3Parents.get(gN.id) === cN.id) return true;
          // Fallback: ID prefix correlation
          const cNum = cN.id.replace("node-", "");
          const gNum = gN.id.replace("node-", "");
          return gNum.startsWith(cNum) && gNum !== cNum;
        });

        return {
          node: cN,
          grandchildren
        };
      });

      // Sort children: descending by node.priority, with alphabetic ID ascending fallback
      const sortedChildren = [...children].sort((a, b) => {
        const pA = a.node.priority !== undefined ? a.node.priority : (a.node.weight || 2);
        const pB = b.node.priority !== undefined ? b.node.priority : (b.node.weight || 2);
        if (pB !== pA) {
          return pB - pA;
        }
        return a.node.id.localeCompare(b.node.id);
      });

      return {
        node: pN,
        children: sortedChildren
      };
    });

    return tree;
  }, [nodes, edges]);

  // Handle checking whether a node triggers lock warning
  const isNodeLocked = (node: ActiveNode) => {
    if (!node.isIsolated && node.visibility_status !== "isolated_passphrase") {
      return false;
    }
    const hash = (node.access_key_hash || node.accessKeyHash || "").toUpperCase().trim();
    if (!hash) return false;
    return !unlockedTokens.includes(hash);
  };

  // Perform client outline filtration matching search keyword
  const filteredTree = useMemo(() => {
    if (!searchTerm.trim()) return hierarchyTree;

    const term = searchTerm.toLowerCase();

    return hierarchyTree.map(parentGroup => {
      const parentMatch = 
        formatNodeLabel(parentGroup.node.label).toLowerCase().includes(term) ||
        parentGroup.node.summary.toLowerCase().includes(term) ||
        parentGroup.node.id.toLowerCase().includes(term);

      const matchedChildren = parentGroup.children.map(childGroup => {
        const childMatch = 
          formatNodeLabel(childGroup.node.label).toLowerCase().includes(term) ||
          childGroup.node.summary.toLowerCase().includes(term) ||
          childGroup.node.id.toLowerCase().includes(term);

        const matchedGrandchildren = childGroup.grandchildren.filter(gNode => {
          return formatNodeLabel(gNode.label).toLowerCase().includes(term) ||
            gNode.summary.toLowerCase().includes(term) ||
            gNode.id.toLowerCase().includes(term);
        });

        if (childMatch || matchedGrandchildren.length > 0) {
          return {
            ...childGroup,
            grandchildren: childMatch ? childGroup.grandchildren : matchedGrandchildren,
            isPartialMatch: true
          };
        }
        return null;
      }).filter(Boolean) as any[];

      if (parentMatch || matchedChildren.length > 0) {
        return {
          ...parentGroup,
          children: parentMatch ? parentGroup.children : matchedChildren,
          isPartialMatch: true
        };
      }

      return null;
    }).filter(Boolean) as any[];
  }, [hierarchyTree, searchTerm]);

  return (
    <div className="w-full h-full flex flex-col bg-[#0D0D0F] rounded-xl border border-zinc-800/40 text-sans select-none overflow-hidden">
      {/* Search Bar */}
      <div className="p-3 border-b border-zinc-900/60 flex items-center justify-between gap-3 bg-[#111113]">
        <div className="flex items-center gap-2 text-zinc-400">
          <Settings className="w-4 h-4 text-[#2DD4BF] animate-pulse" />
          <span className="text-[10px] uppercase font-mono tracking-widest font-bold text-zinc-200">
            Interactive Model hierarchy
          </span>
        </div>
        <div className="relative max-w-[180px] w-full">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter notes..."
            className="w-full pl-7 pr-2.5 py-1 text-[10px] font-mono bg-[#070708] border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#2DD4BF]/50 transition-all font-bold"
          />
        </div>
      </div>

      {/* Hierarchy Outline Scroller */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar text-xs">
        {filteredTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2 font-mono text-zinc-600">
            <Info className="w-5 h-5 text-zinc-700" />
            <div className="text-[10px]">No matches found in outline.</div>
          </div>
        ) : (
          filteredTree.map(({ node: pNode, children }) => {
            const isL1Selected = selectedNodeId === pNode.id;
            const isL1Collapsed = collapsedNodes[pNode.id];
            const isL1Locked = isNodeLocked(pNode);

            return (
              <div 
                key={pNode.id} 
                className={`rounded-xl border transition-all ${
                  isL1Selected 
                    ? "border-emerald-500/40 bg-emerald-950/5 shadow-[0_0_12px_rgba(45,212,191,0.04)]" 
                    : "border-zinc-900 bg-zinc-950/20 hover:border-zinc-800"
                }`}
              >
                {/* LEVEL 1: Parent Item */}
                <div 
                  onClick={() => onSelectNode(pNode.id)}
                  className="p-3 flex items-start gap-2.5 cursor-pointer select-none group min-w-0"
                >
                  <button 
                    onClick={(e) => toggleCollapse(pNode.id, e)}
                    className="p-1 rounded hover:bg-zinc-850/80 text-zinc-500 hover:text-zinc-300 transition-colors mt-0.5"
                  >
                    {isL1Collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <div className={`p-1.5 rounded-lg border shrink-0 ${
                    isL1Selected 
                      ? "bg-[#2DD4BF]/15 border-[#2DD4BF]/20 text-[#2DD4BF]" 
                      : "bg-zinc-900 border-zinc-800 text-teal-400 group-hover:text-[#2DD4BF]/90"
                  }`}>
                    <Folder className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-mono uppercase bg-teal-950/40 text-[#2DD4BF] border border-teal-800/20 px-1.5 py-0.2 rounded font-semibold tracking-wider">
                        L1
                      </span>
                      {isL1Locked && (
                        <span className="text-[9px] font-mono bg-pink-950/40 text-pink-400 border border-pink-900/30 px-1 py-0.2 rounded-md flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> Secured
                        </span>
                      )}
                      {!isL1Locked && pNode.visibility_status === "isolated_passphrase" && (
                        <span className="text-[9px] font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 px-1 py-0.2 rounded-md flex items-center gap-0.5">
                          <Unlock className="w-2.5 h-2.5" /> Unlocked
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-zinc-500 font-bold">
                        {pNode.id}
                      </span>
                    </div>

                    <h4 className={`text-xs font-bold mt-1 tracking-tight transition ${
                      isL1Selected ? "text-[#2DD4BF]" : "text-zinc-100 group-hover:text-white"
                    }`}>
                      {formatNodeLabel(pNode.label)}
                    </h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug line-clamp-1">
                      {pNode.summary}
                    </p>
                  </div>

                  <div className="self-center opacity-0 group-hover:opacity-100 transition px-1">
                    <Edit3 className="w-3.5 h-3.5 text-zinc-400 hover:text-[#2DD4BF]" />
                  </div>
                </div>

                {/* LEVEL 2 & 3 NESTED CONTAINER */}
                {!isL1Collapsed && children.length > 0 && (
                  <div className="border-t border-zinc-900 bg-zinc-950/10 pl-5 pr-3 py-1 space-y-2 relative">
                    {/* Level 1 structural connector link */}
                    <div className="absolute left-[21px] top-0 bottom-4 w-px bg-zinc-805/45 bg-gradient-to-b from-[#2DD4BF]/20 via-zinc-800 to-transparent pointer-events-none" />

                    {children.map(({ node: cNode, grandchildren }) => {
                      const isL2Selected = selectedNodeId === cNode.id;
                      const isL2Collapsed = collapsedNodes[cNode.id];
                      const isL2Locked = isNodeLocked(cNode);

                      return (
                        <div 
                          key={cNode.id}
                          className={`rounded-lg border transition-all mt-1.5 ${
                            isL2Selected 
                              ? "border-emerald-500/25 bg-[#2DD4BF]/5 shadow-[0_0_8px_rgba(45,212,191,0.02)]" 
                              : "border-transparent bg-transparent hover:border-zinc-800/40 hover:bg-zinc-900/10"
                          }`}
                        >
                          {/* LEVEL 2: Child Item */}
                          <div 
                            onClick={(e) => {
                              onSelectNode(cNode.id);
                            }}
                            className="p-2 flex items-start gap-2 cursor-pointer select-none group min-w-0"
                          >
                            <button 
                              onClick={(e) => toggleCollapse(cNode.id, e)}
                              className="p-0.5 rounded hover:bg-zinc-850 text-zinc-500 hover:text-zinc-400 mt-0.5"
                            >
                              {isL2Collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>

                            <div className={`p-1 rounded-md shrink-0 border mt-0.5 ${
                              isL2Selected 
                                ? "bg-[#2DD4BF]/10 border-[#2DD4BF]/20 text-[#2DD4BF]" 
                                : "bg-zinc-900/60 border-zinc-850 text-amber-400/90 group-hover:text-amber-400"
                            }`}>
                              <Layers className="w-3.5 h-3.5" />
                            </div>

                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[9px] font-mono uppercase bg-amber-950/30 text-amber-400 border border-amber-900/20 px-1 py-0.1 rounded font-semibold tracking-wide">
                                  L2
                                </span>
                                {isL2Locked && (
                                  <span className="text-[9px] font-mono bg-pink-950/40 text-pink-400 border border-pink-900/30 px-1 py-0.1 rounded flex items-center gap-0.5 scale-95 origin-left">
                                    <Lock className="w-2 h-2" /> Secured
                                  </span>
                                )}
                                <span className="text-[9.5px] font-mono text-zinc-500 font-bold">
                                  {cNode.id}
                                </span>
                              </div>

                              <h5 className={`text-[11.5px] font-semibold mt-0.5 tracking-tight transition ${
                                isL2Selected ? "text-[#2DD4BF]" : "text-zinc-200 group-hover:text-zinc-100"
                              }`}>
                                {formatNodeLabel(cNode.label)}
                              </h5>
                              <p className="text-[10.5px] text-zinc-400 leading-snug line-clamp-1 mt-0.5">
                                {cNode.summary}
                              </p>
                            </div>

                            <div className="self-center opacity-0 group-hover:opacity-100 transition px-1">
                              <Edit3 className="w-3 h-3 text-zinc-400 hover:text-[#2DD4BF]" />
                            </div>
                          </div>

                          {/* LEVEL 3: Grandchildren Leaf List */}
                          {!isL2Collapsed && grandchildren.length > 0 && (
                            <div className="pl-6 pr-2 py-0.5 space-y-1.5 relative border-l border-zinc-850/60 ml-2.5 mb-1.5">
                              {grandchildren.map((gNode) => {
                                const isL3Selected = selectedNodeId === gNode.id;
                                const isL3Locked = isNodeLocked(gNode);

                                return (
                                  <div 
                                    key={gNode.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSelectNode(gNode.id);
                                    }}
                                    className={`p-1.5 rounded flex items-start gap-2 cursor-pointer select-none group/leaf transition-all border ${
                                      isL3Selected 
                                        ? "border-emerald-500/20 bg-emerald-950/5 text-[#2DD4BF]" 
                                        : "border-transparent text-zinc-400 hover:bg-zinc-900/20 hover:text-zinc-200"
                                    }`}
                                  >
                                    <div className={`p-0.5 rounded shrink-0 border mt-0.5 ${
                                      isL3Selected 
                                        ? "bg-teal-500/10 border-teal-500/25 text-[#2DD4BF]" 
                                        : "bg-zinc-900/40 border-zinc-850/30 text-zinc-500 group-hover/leaf:text-zinc-350"
                                    }`}>
                                      <FileText className="w-3 h-3" />
                                    </div>

                                    <div className="flex-1 min-w-0 text-left">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[8px] font-mono uppercase bg-zinc-800 text-zinc-300 px-1 py-0.05 rounded font-bold">
                                          L3
                                        </span>
                                        {isL3Locked && (
                                          <span className="text-[8px] font-mono bg-pink-950/30 text-pink-500 border border-pink-900/30 px-0.5 py-0.05 rounded-sm scale-90 origin-left">
                                            Locked
                                          </span>
                                        )}
                                        <span className="text-[9px] font-mono text-zinc-650 font-bold">
                                          {gNode.id}
                                        </span>
                                      </div>
                                      <h6 className={`text-[11px] font-medium mt-0.5 leading-tight transition ${
                                        isL3Selected ? "text-[#2DD4BF]" : "text-zinc-350 group-hover/leaf:text-zinc-150"
                                      }`}>
                                        {formatNodeLabel(gNode.label)}
                                      </h6>
                                      <p className="text-[10px] text-zinc-500 mt-0.5 truncate leading-tight">
                                        {gNode.summary}
                                      </p>
                                    </div>

                                    <div className="self-center opacity-0 group-hover/leaf:opacity-100 transition px-0.5">
                                      <Edit3 className="w-2.5 h-2.5 text-zinc-500 hover:text-[#2DD4BF]" />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Action Footer banner */}
      <div className="bg-[#111113] px-4 py-2 border-t border-zinc-900/60 flex items-center justify-between text-[10px] font-mono text-zinc-500">
        <div className="flex items-center gap-1">
          <Globe className="w-3.5 h-3.5 text-teal-400" />
          <span>Nodes: {nodes.length}</span>
        </div>
        <div className="flex items-center gap-1 font-bold text-teal-400/90 hover:text-[#2DD4BF] cursor-pointer">
          <span>Active Write Synced</span>
          <Check className="w-3 h-3 text-emerald-400" />
        </div>
      </div>
    </div>
  );
};
