const fs = require('fs');
const file = 'src/components/V2GuidedFlow.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /onClick=\{\(\) => \{\n\s*if \(onSwitchProfile\) onSwitchProfile\(selectedNode\.doppelgangerHandle!\);\n\s*if \(onSelectNode\) onSelectNode\(null\);\n\s*\}\}/g,
  `onClick={(e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onSwitchProfile) onSwitchProfile(selectedNode.doppelgangerHandle!);
    setTimeout(() => {
      if (onSelectNode) onSelectNode(null);
    }, 0);
  }}`
);

content = content.replace(
  /onClick=\{\(\) => \{\n\s*if \(onSwitchProfile\) onSwitchProfile\(creatorInfo\.handle\);\n\s*if \(onSelectNode\) onSelectNode\(null\);\n\s*\}\}/g,
  `onClick={(e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onSwitchProfile) onSwitchProfile(creatorInfo.handle);
    setTimeout(() => {
      if (onSelectNode) onSelectNode(null);
    }, 0);
  }}`
);

fs.writeFileSync(file, content);
console.log("Patched!");
