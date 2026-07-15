const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');
const start = lines.findIndex(l => l.includes('const DEFAULT_MOCK_STATE: StateBlueprint = {'));
let end = start;
let braces = 0;
for(let i=start; i<lines.length; i++) {
  if (lines[i].includes('{')) braces += (lines[i].match(/\{/g) || []).length;
  if (lines[i].includes('}')) braces -= (lines[i].match(/\}/g) || []).length;
  if (braces === 0) {
    end = i;
    break;
  }
}
console.log(`Lines: ${start+1} to ${end+1}`);
