// App-wide actions any view can trigger without threading props through every
// layer: open a company page, or open the document studio for a role. App
// provides the real functions; outside a provider (tests) both are null and
// the buttons that need them hide themselves.
import { createContext, useContext } from 'react';

export const AppActionsContext = createContext({ openCompany: null, openDocumentStudio: null });

export const useAppActions = () => useContext(AppActionsContext);
