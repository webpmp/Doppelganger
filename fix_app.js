import fs from 'fs';
let appTsx = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add notes for Third Party Integration to ALEX_MOCK_STATE
const alexNotesTarget = `  notes: [
    {
      node_id: "node-a10",`;

const alexNotesReplace = `  notes: [
    {
      node_id: "node-11.0",
      content: "Project led by Alex Morgan to integrate Stripe, SendGrid, and other third-party services into the platform.",
      source_origin: "Journal_v1"
    },
    {
      node_id: "node-11.1",
      content: "Setting up Stripe for processing subscriptions and handling webhook events for payment failures.",
      source_origin: "Journal_v2"
    },
    {
      node_id: "node-a10",`;

appTsx = appTsx.replace(alexNotesTarget, alexNotesReplace);

// 2. Add notes for User Research Study to DEFAULT_MOCK_STATE
const defaultNotesTarget = `  notes: [
    {
      node_id: "node-1.1",`;

const defaultNotesReplace = `  notes: [
    {
      node_id: "node-12.0",
      content: "Comprehensive study to understand user behaviors and preferences.",
      source_origin: "Journal_v1"
    },
    {
      node_id: "node-12.1",
      content: "Conducting 1-on-1 interviews with target demographics.",
      source_origin: "Journal_v2"
    },
    {
      node_id: "node-1.1",`;

appTsx = appTsx.replace(defaultNotesTarget, defaultNotesReplace);

// 3. Update Branding Update Guidelines in JORDAN_MOCK_STATE
const jordanNodeTarget = `    {
      id: "node-j20",
      label: "Branding Update Guidelines",
      summary: "Enforcing typography and token sync protocols throughout sprint cycles.",
      node_state: "active",
      visibility_status: "public",
      access_key_hash: null,
      accessKeyHash: null,
      isIsolated: false,
      weight: 3.0,
      level: 1,
      priority: 4
    },`;

const jordanNodeReplace = `    {
      id: "node-j20",
      label: "Branding Update Guidelines",
      summary: "Enforcing typography and token sync protocols throughout sprint cycles.",
      node_state: "active",
      visibility_status: "public",
      access_key_hash: null,
      accessKeyHash: null,
      isIsolated: false,
      weight: 2.0,
      level: 2,
      priority: 4,
      parentId: "node-4.0"
    },`;

appTsx = appTsx.replace(jordanNodeTarget, jordanNodeReplace);

// Add edge in JORDAN_MOCK_STATE
// Find edges: [ in JORDAN_MOCK_STATE
const jordanEdgesTarget = `  edges: [
    {
      source: "node-j11",`;

const jordanEdgesReplace = `  edges: [
    {
      source: "node-j20",
      target: "node-4.0",
      relation: "child_of"
    },
    {
      source: "node-j11",`;

appTsx = appTsx.replace(jordanEdgesTarget, jordanEdgesReplace);

fs.writeFileSync('src/App.tsx', appTsx);
console.log("Updated App.tsx successfully");
