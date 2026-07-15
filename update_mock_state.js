import fs from 'fs';
const appTsx = fs.readFileSync('src/App.tsx', 'utf8');

const newProjects = `
    {
      id: "node-10.0",
      label: "User Research Study",
      summary: "Quantitative and qualitative research on user onboarding.",
      notes: "Research study led by Chris Adkins to understand the friction points during initial user onboarding and account setup.",
      node_state: "active",
      visibility_status: "public",
      weight: 3,
      level: 1,
      priority: 4,
      isIsolated: false,
      access_key_hash: null,
      accessKeyHash: null,
      ownerName: "Chris Adkins",
      ownerHandle: "@chris.adkins"
    },
    {
      id: "node-10.1",
      label: "User Interviews",
      summary: "Conducting 1:1 sessions with recent signups.",
      notes: "Scheduling and running 20 user interviews to gather qualitative feedback on the onboarding experience.",
      node_state: "active",
      visibility_status: "public",
      weight: 2,
      level: 2,
      priority: 3,
      isIsolated: false,
      access_key_hash: null,
      accessKeyHash: null,
      parentId: "node-10.0",
      ownerName: "Chris Adkins"
    },
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

const updatedAppTsx = appTsx.replace(
  'activeNodes: [',
  'activeNodes: [' + newProjects
);

const newEdges = `
    {
      source: "node-10.1",
      target: "node-10.0",
      relation: "child_of"
    },
    {
      source: "node-11.1",
      target: "node-11.0",
      relation: "child_of"
    },
`;
const updatedAppTsxEdges = updatedAppTsx.replace(
  'edges: [',
  'edges: [' + newEdges
);

fs.writeFileSync('src/App.tsx', updatedAppTsxEdges);
console.log("updated app.tsx with mock projects");
