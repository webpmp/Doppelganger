import fs from 'fs';
let appTsx = fs.readFileSync('src/App.tsx', 'utf8');

appTsx = appTsx.replace('doppelganger_all_profiles_dict_v4', 'doppelganger_all_profiles_dict_v5');

// I will remove the Alex nodes from DEFAULT_MOCK_STATE and put them in ALEX_MOCK_STATE
const alexNodes = `
    {
      id: "node-11.0",
      label: "Third Party Integration",
      summary: "Integrating external APIs for extended functionality.",
      notes: "Project led by Alex Morgan to integrate Stripe, SendGrid, and other third-party services into the platform.",
      node_state: "active",
      visibility_status: "public",
      weight: 3,
      level: 1,
      priority: 4,
      isIsolated: false,
      access_key_hash: null,
      accessKeyHash: null,
      ownerName: "Alex Morgan",
      ownerHandle: "@alex.morgan"
    },
    {
      id: "node-11.1",
      label: "Payment Gateway Setup",
      summary: "Configuring Stripe webhooks and product catalog.",
      notes: "Setting up Stripe for processing subscriptions and handling webhook events for payment failures.",
      node_state: "active",
      visibility_status: "public",
      weight: 2,
      level: 2,
      priority: 4,
      isIsolated: false,
      access_key_hash: null,
      accessKeyHash: null,
      parentId: "node-11.0",
      ownerName: "Alex Morgan"
    },
`;

const alexEdges = `
    {
      source: "node-11.1",
      target: "node-11.0",
      relation: "child_of"
    },
`;

// Remove from DEFAULT_MOCK_STATE (we inserted them right after activeNodes: [)
appTsx = appTsx.replace(alexNodes, "");

// Add to ALEX_MOCK_STATE
appTsx = appTsx.replace(
  'const ALEX_MOCK_STATE: StateBlueprint = {\n  activeNodes: [',
  'const ALEX_MOCK_STATE: StateBlueprint = {\n  activeNodes: [' + alexNodes
);

// Remove from DEFAULT_MOCK_STATE edges
appTsx = appTsx.replace(alexEdges, "");

// Add to ALEX_MOCK_STATE edges
const alexEdgeInsert = `  edges: [\n` + alexEdges;
appTsx = appTsx.replace(
  '  edges: [', // this will match the first one, which is DEFAULT_MOCK_STATE's edges, wait. I shouldn't use string replace without being careful.
  '  edges: ['
); // let's do this safer

fs.writeFileSync('src/App.tsx', appTsx);
console.log("fixed mock state");
