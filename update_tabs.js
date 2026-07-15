import fs from 'fs';
let fileContent = fs.readFileSync('src/components/V2GuidedFlow.tsx', 'utf8');

const target = `                <div className="session-tabs-deck flex items-end gap-1.5 select-none overflow-x-auto no-scrollbar">
                  {headerMode === 'topics' ? (
                    sessions
                      .filter(session => {
                        // Do not display the tab if it has no history OR if it is still loading its initial topic
                        if (!session.history || session.history.length === 0) return false;
                        if (!session.topicTitle || session.topicTitle.trim() === "" || session.topicTitle === "New Thread") return false;
                        return true;
                      })
                      .map(session => {
                        const isSelected = session.id === activeSessionId;
                        return (
                          <div
                            key={session.id}
                            className="group relative flex items-center"
                          >`;

const replacement = `                <div className="session-tabs-deck flex items-end gap-1.5 select-none overflow-x-auto no-scrollbar">
                  <AnimatePresence mode="popLayout">
                  {headerMode === 'topics' ? (
                    sessions
                      .filter(session => {
                        // Do not display the tab if it has no history OR if it is still loading its initial topic
                        if (!session.history || session.history.length === 0) return false;
                        if (!session.topicTitle || session.topicTitle.trim() === "" || session.topicTitle === "New Thread") return false;
                        return true;
                      })
                      .map(session => {
                        const isSelected = session.id === activeSessionId;
                        return (
                          <motion.div
                            key={session.id}
                            className="group relative flex items-center"
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                          >`;

const targetEnd1 = `                            </button>
                          </div>
                        );
                      })
                  ) : (`;

const replaceEnd1 = `                            </button>
                          </motion.div>
                        );
                      })
                  ) : (`;

const targetEnd2 = `                              </span>
                            </button>
                          </div>
                        );
                      })
                  )}
                </div>`;

const replaceEnd2 = `                              </span>
                            </button>
                          </div>
                        );
                      })
                  )}
                  </AnimatePresence>
                </div>`;

fileContent = fileContent.replace(target, replacement);
fileContent = fileContent.replace(targetEnd1, replaceEnd1);
fileContent = fileContent.replace(targetEnd2, replaceEnd2);

fs.writeFileSync('src/components/V2GuidedFlow.tsx', fileContent);
console.log("Updated V2GuidedFlow.tsx successfully");
