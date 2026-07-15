import fs from 'fs';
let serverTs = fs.readFileSync('server.ts', 'utf8');

const targetStr = `    // Step 2: Locate project root node from query keywords
    const PROJECT_KEYWORD_MAP: { queryTerms: string[]; labelTerms: string[] }[] = [
      { queryTerms: ["mobile", "redesign"],                               labelTerms: ["mobile", "redesign"] },
      { queryTerms: ["kinetic", "motion", "type prototype"],              labelTerms: ["kinetic"] },
      { queryTerms: ["design sprint", "sprint planning", "sprints"],     labelTerms: ["sprint"] },
      { queryTerms: ["branding", "brand update"],                         labelTerms: ["brand"] },
      { queryTerms: ["platform developer", "developer experience"],       labelTerms: ["platform"] },
      { queryTerms: ["graphql", "stitching", "federated"],               labelTerms: ["graphql", "federated"] },
      { queryTerms: ["aegis"],                                            labelTerms: ["aegis"] },
      { queryTerms: ["cobalt"],                                           labelTerms: ["cobalt"] },
    ];`;

const replaceStr = `    // Step 2: Locate project root node from query keywords
    const PROJECT_KEYWORD_MAP: { queryTerms: string[]; labelTerms: string[] }[] = [
      { queryTerms: ["mobile", "redesign"],                               labelTerms: ["mobile", "redesign"] },
      { queryTerms: ["kinetic", "motion", "type prototype"],              labelTerms: ["kinetic"] },
      { queryTerms: ["design sprint", "sprint planning", "sprints"],     labelTerms: ["sprint"] },
      { queryTerms: ["branding", "brand update"],                         labelTerms: ["brand"] },
      { queryTerms: ["platform developer", "developer experience"],       labelTerms: ["platform"] },
      { queryTerms: ["graphql", "stitching", "federated"],               labelTerms: ["graphql", "federated"] },
      { queryTerms: ["aegis"],                                            labelTerms: ["aegis"] },
      { queryTerms: ["cobalt"],                                           labelTerms: ["cobalt"] },
    ];

    // Dynamically add all Level 1 projects to the keyword map
    accessibleNodes.forEach((n: any) => {
      if (getStoredLevel(n) === 1) {
        const label = (n.label || n.title || "").toLowerCase();
        const cleanLabel = label.replace(/[^\\w\\s]/g, "").trim();
        if (cleanLabel.length > 0) {
          PROJECT_KEYWORD_MAP.push({ queryTerms: [cleanLabel], labelTerms: [cleanLabel] });
        }
      }
    });`;

serverTs = serverTs.replace(targetStr, replaceStr);
fs.writeFileSync('server.ts', serverTs);
console.log("Updated server.ts successfully");
