import fs from 'fs';
let appTsx = fs.readFileSync('src/App.tsx', 'utf8');

// Add edge in DEFAULT_MOCK_STATE
const defaultEdgesTarget = `  edges: [
    {
      source: "node-10.1",
      target: "node-10.0",`;

const defaultEdgesReplace = `  edges: [
    {
      source: "node-12.1",
      target: "node-12.0",
      relation: "child_of"
    },
    {
      source: "node-10.1",
      target: "node-10.0",`;

appTsx = appTsx.replace(defaultEdgesTarget, defaultEdgesReplace);


// Add edge in ALEX_MOCK_STATE
const alexEdgesTarget = `    { source: "node-a11", target: "node-a10", relation: "child_of" },`;

const alexEdgesReplace = `    { source: "node-a11", target: "node-a10", relation: "child_of" },
    { source: "node-11.1", target: "node-11.0", relation: "child_of" },`;

appTsx = appTsx.replace(alexEdgesTarget, alexEdgesReplace);

fs.writeFileSync('src/App.tsx', appTsx);
console.log("Updated edges successfully");
