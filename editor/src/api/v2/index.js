// Data access for the rebuilt screens (docs/rebuild-plan.md, phase 1b). Each new
// screen talks only to these objects. Two implementations share one interface:
//
//   mock  sample data served from the browser, so the UI can be built before the
//         phase 2 API exists. Never invents facts about real companies; where
//         nothing is known it says so, or shows a flow labelled "typical".
//   http  the phase 2 REST API, as written down in docs/api-v2.md.
//
// The mode is fixed at build time: VITE_DATA_MODE=mock|http, defaulting to mock
// in `vite dev` and http in a production build.
import * as mock from './mock.js';
import * as http from './http.js';

const env = import.meta.env || {};
const requested = env.VITE_DATA_MODE;
export const DATA_MODE = requested === 'mock' || requested === 'http' ? requested : (env.DEV ? 'mock' : 'http');
export const isSampleData = DATA_MODE === 'mock';

const impl = isSampleData ? mock : http;

export const companyApi = impl.companyApi;
export const searchApi = impl.searchApi;
export const documentsApi = impl.documentsApi;
export const mailboxesApi = impl.mailboxesApi;
