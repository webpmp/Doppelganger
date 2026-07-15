import fs from 'fs';
let v2Flow = fs.readFileSync('src/components/V2GuidedFlow.tsx', 'utf8');

const targetStr = `    const activeProfileNodes = graphState.activeNodes.filter(node => {
      if (node.node_state !== "active") return false;
      if (node.doppelgangerHandle !== activeProfileHandle) return false;`;

if (v2Flow.includes(targetStr)) {
  console.log("Found target string!");
} else {
  console.log("NOT FOUND!");
}
