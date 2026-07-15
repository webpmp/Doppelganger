const fs = require('fs');
const file = 'src/components/V2GuidedFlow.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /onClick=\{\(\) => \{\n\s*if \(onSwitchProfile\) onSwitchProfile\(selectedNode\.doppelgangerHandle!\);\n\s*if \(onSelectNode\) onSelectNode\(null\);\n\s*\}\}/g,
  `onClick={() => {
    handleDoppelgangerClickFromCard(selectedNode.doppelgangerHandle!);
    if (onSelectNode) onSelectNode(null);
  }}`
);

content = content.replace(
  /onClick=\{\(\) => \{\n\s*if \(onSwitchProfile\) onSwitchProfile\(creatorInfo\.handle\);\n\s*if \(onSelectNode\) onSelectNode\(null\);\n\s*\}\}/g,
  `onClick={() => {
    handleDoppelgangerClickFromCard(creatorInfo.handle);
    if (onSelectNode) onSelectNode(null);
  }}`
);

fs.writeFileSync(file, content);
console.log("Patched 3!");
