import fs from 'fs';
let fileContent = fs.readFileSync('src/components/KnowledgeGraphCanvas.tsx', 'utf8');

const forceXTarget = `      .force("x", d3.forceX<D3Node>()
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
            if (d.id === expandedParentId) return 0.45;
            if (workflowMode === 'v2' && citedNodeIds && citedNodeIds.length > 0) {
              return citedNodeIds.includes(d.id) ? 0.4 : 0.02;
            }
            return 0.3;
          }
          return 0.15;
        })
      )`;

const forceYTarget = `      .force("y", d3.forceY<D3Node>()
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
            if (d.id === expandedParentId) return 0.45;
            if (workflowMode === 'v2' && citedNodeIds && citedNodeIds.length > 0) {
              return citedNodeIds.includes(d.id) ? 0.4 : 0.02;
            }
            return 0.3;
          }
          return 0.15;
        })
      )`;


const forceXReplace = `      .force("x", d3.forceX<D3Node>()
        .x((d: any) => {
          if (getNodeLevel(d) === 1) {
            if (d.id === expandedParentId) return width / 2;
            if (expandedParentId) {
              const index = parentD3Nodes.findIndex(pn => pn.id === d.id);
              const angle = (index / parentD3Nodes.length) * 2 * Math.PI;
              return width / 2 + Math.cos(angle) * (width * 0.45);
            }
            if (workflowMode === 'v2' && citedNodeIds && citedNodeIds.length > 0) {
              if (!citedNodeIds.includes(d.id)) {
                 const inactiveNodes = parentD3Nodes.filter(pn => !citedNodeIds.includes(pn.id));
                 const index = inactiveNodes.findIndex(pn => pn.id === d.id);
                 const angle = (index / Math.max(1, inactiveNodes.length)) * 2 * Math.PI;
                 return width / 2 + Math.cos(angle) * (width * 0.4);
              }
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
            if (d.id === expandedParentId) return 0.45;
            if (workflowMode === 'v2' && citedNodeIds && citedNodeIds.length > 0) {
              return citedNodeIds.includes(d.id) ? 0.45 : 0.35;
            }
            return 0.3;
          }
          return 0.15;
        })
      )`;

const forceYReplace = `      .force("y", d3.forceY<D3Node>()
        .y((d: any) => {
          if (getNodeLevel(d) === 1) {
            if (d.id === expandedParentId) return height / 2;
            if (expandedParentId) {
              const index = parentD3Nodes.findIndex(pn => pn.id === d.id);
              const angle = (index / parentD3Nodes.length) * 2 * Math.PI;
              return height / 2 + Math.sin(angle) * (height * 0.45);
            }
            if (workflowMode === 'v2' && citedNodeIds && citedNodeIds.length > 0) {
              if (!citedNodeIds.includes(d.id)) {
                 const inactiveNodes = parentD3Nodes.filter(pn => !citedNodeIds.includes(pn.id));
                 const index = inactiveNodes.findIndex(pn => pn.id === d.id);
                 const angle = (index / Math.max(1, inactiveNodes.length)) * 2 * Math.PI;
                 return height / 2 + Math.sin(angle) * (width * 0.4);
              }
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
            if (d.id === expandedParentId) return 0.45;
            if (workflowMode === 'v2' && citedNodeIds && citedNodeIds.length > 0) {
              return citedNodeIds.includes(d.id) ? 0.45 : 0.35;
            }
            return 0.3;
          }
          return 0.15;
        })
      )`;

fileContent = fileContent.replace(forceXTarget, forceXReplace);
fileContent = fileContent.replace(forceYTarget, forceYReplace);
fs.writeFileSync('src/components/KnowledgeGraphCanvas.tsx', fileContent);
console.log("Updated KnowledgeGraphCanvas layout explicitly");
