import fs from 'fs';
let fileContent = fs.readFileSync('src/components/V2GuidedFlow.tsx', 'utf8');

// 1. Remove the useEffect that forcibly creates/switches sessions based on activeProfileHandle
const useEffectTarget = `  useEffect(() => {
    // When profile changes, look for an existing session that matches the new profile's name...
    const pInfo = getProfileInfo(activeProfileHandle);
    const pName = pInfo.name.toLowerCase().trim();
    if (!pName) return;

    // Check if a session already exists with this topicTitle (case-insensitive)
    let existingSession = sessions.find(s => s.topicTitle.toLowerCase() === pName.toLowerCase());

    if (existingSession) {
      if (activeSessionId !== existingSession.id) {
        setActiveSessionId(existingSession.id);
        setV2Threads(existingSession.history);
        if (existingSession.history.length > 0) {
          setV2FocusedThreadId(existingSession.history[existingSession.history.length - 1].id);
        } else {
          setV2FocusedThreadId(null);
        }
      }
    } else {
      // Create a brand new tab for this doppelganger!
      const newSessionId = \`session-profile-\${activeProfileHandle.replace("@", "").replace(".", "-")}-\${Date.now()}\`;
      const newSessionObj: V2Session = {
        id: newSessionId,
        topicTitle: pName,
        history: []
      };
      setSessions(prev => {
        if (prev.some(s => s.topicTitle.toLowerCase() === pName.toLowerCase())) return prev;
        return [...prev, newSessionObj];
      });
      setActiveSessionId(newSessionId);
      setV2Threads([]);
      setV2FocusedThreadId(null);
    }
  }, [activeProfileHandle]);`;

fileContent = fileContent.replace(useEffectTarget, `  useEffect(() => {
    // When profile changes via sidebar, ensure we show all their notes (inactive ones grayed out)
    setMapFilterMode('all');
  }, [activeProfileHandle]);`);


// 2. Change threadOwner filtering to use activeProfileHandle
const filterTarget = `    const threadOwner = activeThread?.ownerHandle || activeProfileHandle;
    const activeProfileNodes = graphState.activeNodes.filter(node => {
      if (node.node_state !== "active") return false;
      if (node.doppelgangerHandle !== threadOwner) return false;`;

const filterReplace = `    const threadOwner = activeThread?.ownerHandle || activeProfileHandle;
    const activeProfileNodes = graphState.activeNodes.filter(node => {
      if (node.node_state !== "active") return false;
      if (node.doppelgangerHandle !== activeProfileHandle) return false;`;

fileContent = fileContent.replace(filterTarget, filterReplace);


// 3. Update switchSession to restore activeProfileHandle based on the thread
const switchSessionTarget = `      if (matchProf && onSwitchProfile) {
        onSwitchProfile(matchProf.handle);
      } else if (onSwitchProfile && ownerHandle && activeProfileHandle !== ownerHandle) {
        onSwitchProfile(ownerHandle);
      }`;

const switchSessionReplace = `      if (matchProf && onSwitchProfile) {
        onSwitchProfile(matchProf.handle);
      } else if (onSwitchProfile && targetSession.history.length > 0) {
        const lastThread = targetSession.history[targetSession.history.length - 1];
        if (lastThread.ownerHandle && activeProfileHandle !== lastThread.ownerHandle) {
          onSwitchProfile(lastThread.ownerHandle);
        }
      }`;

fileContent = fileContent.replace(switchSessionTarget, switchSessionReplace);

fs.writeFileSync('src/components/V2GuidedFlow.tsx', fileContent);
console.log("Updated V2GuidedFlow successfully");
