# Node Level Language Rules

## Canonical Label Mapping (Required)
All AI-generated responses must use the following functional mapping when referring to node levels:
- Level 1 → Top-level Project
- Level 2 → Workstream
- Level 3 → Task

## Output Constraints (Strict)
The AI must follow these rules in all responses:
- Never reference numeric hierarchy levels (e.g., “Level 1”, “Level 2”, “Level 3”)
- Never use structural terms such as “parent”, “child”, or “grandchild”
- Always describe nodes using functional labels only:
  - Top-level Project
  - Workstream
  - Task
- Only include these labels when they improve clarity; otherwise omit level references entirely
- Do not explain or expose the mapping system to the user in responses

## Behavioral Requirement
Responses should focus on project meaning and content, not graph structure or hierarchy positioning.

## Docker Restart Rule
You MUST restart docker after every code change. Do not ask for permission, just restart docker using `docker-compose restart` via terminal.
