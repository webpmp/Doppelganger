const fs = require('fs');
const file = 'src/components/V2GuidedFlow.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /onClick=\{\(e\) => \{\n\s*e\.stopPropagation\(\);\n\s*e\.preventDefault\(\);\n\s*if \(onSwitchProfile\) onSwitchProfile\(selectedNode\.doppelgangerHandle!\);\n\s*setTimeout\(\(\) => \{\n\s*if \(onSelectNode\) onSelectNode\(null\);\n\s*\}, 0\);\n\s*\}\}/g,
  `onClick={() => {
    if (onSwitchProfile) onSwitchProfile(selectedNode.doppelgangerHandle!);
    if (onSelectNode) onSelectNode(null);
  }}`
);

content = content.replace(
  /onClick=\{\(e\) => \{\n\s*e\.stopPropagation\(\);\n\s*e\.preventDefault\(\);\n\s*if \(onSwitchProfile\) onSwitchProfile\(creatorInfo\.handle\);\n\s*setTimeout\(\(\) => \{\n\s*if \(onSelectNode\) onSelectNode\(null\);\n\s*\}, 0\);\n\s*\}\}/g,
  `onClick={() => {
    if (onSwitchProfile) onSwitchProfile(creatorInfo.handle);
    if (onSelectNode) onSelectNode(null);
  }}`
);

fs.writeFileSync(file, content);
console.log("Patched 2!");
