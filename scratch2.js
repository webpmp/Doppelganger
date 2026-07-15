import fs from 'fs';
let v2Flow = fs.readFileSync('src/components/V2GuidedFlow.tsx', 'utf8');

const targetStr = `    const activeProfileNodes = graphState.activeNodes.filter(node => {
      if (node.node_state !== "active") return false;
      if (node.doppelgangerHandle !== activeProfileHandle) return false;`;

const replaceStr = `    const threadOwner = activeThread?.ownerHandle || activeProfileHandle;
    const activeProfileNodes = graphState.activeNodes.filter(node => {
      if (node.node_state !== "active") return false;
      if (node.doppelgangerHandle !== threadOwner) return false;`;

v2Flow = v2Flow.replace(targetStr, replaceStr);

// Also update the dependency array of the useMemo
const depsTarget = `}, [activeProfileHandle, graphState?.activeNodes, graphState?.edges, unlockedTokens, mapFilterMode, activeThreadReferencedNodesStr, showInactiveNodes]);`;
const depsReplace = `}, [activeProfileHandle, activeThread?.ownerHandle, graphState?.activeNodes, graphState?.edges, unlockedTokens, mapFilterMode, activeThreadReferencedNodesStr, showInactiveNodes]);`;

v2Flow = v2Flow.replace(depsTarget, depsReplace);

// We should also replace the collaborative logic `activeProfileHandle` with `threadOwner`
const collabTarget = `          if (node.doppelgangerHandle && node.doppelgangerHandle !== activeProfileHandle) {`;
const collabReplace = `          if (node.doppelgangerHandle && node.doppelgangerHandle !== threadOwner) {`;
v2Flow = v2Flow.replace(collabTarget, collabReplace);


fs.writeFileSync('src/components/V2GuidedFlow.tsx', v2Flow);
console.log("Replaced successfully");
