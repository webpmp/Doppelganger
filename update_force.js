import fs from 'fs';
let fileContent = fs.readFileSync('src/components/KnowledgeGraphCanvas.tsx', 'utf8');

// 1. Update forceX strength
const forceXTarget = `        .strength((d: any) => {
          if (getNodeLevel(d) === 1) {
            return d.id === expandedParentId ? 0.45 : 0.3;
          }
          return 0.15;
        })`;

const forceXReplace = `        .strength((d: any) => {
          if (getNodeLevel(d) === 1) {
            if (d.id === expandedParentId) return 0.45;
            if (workflowMode === 'v2' && citedNodeIds && citedNodeIds.length > 0) {
              return citedNodeIds.includes(d.id) ? 0.4 : 0.02;
            }
            return 0.3;
          }
          return 0.15;
        })`;

fileContent = fileContent.replace(forceXTarget, forceXReplace);

// 2. Update forceY strength
// Wait, the string is identical, so replace will just do it again if we search from the modified part?
// I will use replace twice. The first one replaces the first occurrence (forceX), the second replaces the next (forceY).
fileContent = fileContent.replace(forceXTarget, forceXReplace);

// 3. Update getFitTransform to only fit active nodes
const fitTarget = `    const getFitTransform = () => {
      const activeClusterNodes = d3Nodes.filter((node) => {
        if (!expandedParentId) return true;
        return node.id === expandedParentId || parentGroups.parentOfNode.get(node.id) === expandedParentId;
      });`;

const fitReplace = `    const getFitTransform = () => {
      const activeClusterNodes = d3Nodes.filter((node) => {
        if (expandedParentId) {
          return node.id === expandedParentId || parentGroups.parentOfNode.get(node.id) === expandedParentId;
        }
        if (workflowMode === 'v2' && citedNodeIds && citedNodeIds.length > 0) {
          return citedNodeIds.includes(node.id);
        }
        return true;
      });`;

fileContent = fileContent.replace(fitTarget, fitReplace);

fs.writeFileSync('src/components/KnowledgeGraphCanvas.tsx', fileContent);
console.log("Updated KnowledgeGraphCanvas successfully");
