import { buildHafsqlCustomJsonUrl } from "./data/hafsql.js";

// /js/config.js

export const APP_ID = "micro.fair";
export const ADMIN = "faireye";
export const VOTE_CUSTOM_ID = `${APP_ID}.interation`;
export const ADMIN_PMUTE_CUSTOM_ID = `${APP_ID}.adpmuted`;
export const BLOCK_USER_CUSTOM_ID = `${APP_ID}.{user}.block`;
export const FOLLOW_USER_CUSTOM_ID = `${APP_ID}.{user}.follow`;
export const CHANNELS_CUSTOM_ID = `${APP_ID}.channels`;
export const LIMIT = 1000;



// Compatibility shim: existing API URLs stay the same, including {user} templates.
function buildApiUrl(customId) {
    return buildHafsqlCustomJsonUrl(customId, { limit: LIMIT });
}

// URLs FINAIS: Usando a função helper
export const API_URL = buildApiUrl(APP_ID);
export const VOTE_API_URL = buildApiUrl(VOTE_CUSTOM_ID);
export const ADMIN_POST_MUTE_API_URL = buildApiUrl(ADMIN_PMUTE_CUSTOM_ID);
export const CHANNELS_API_URL = buildApiUrl(CHANNELS_CUSTOM_ID);

// URLs com parâmetros variáveis (mantidas para clareza, mas poderiam ser construídas)
export const USER_BLOCK_API_URL = buildApiUrl(BLOCK_USER_CUSTOM_ID);
export const USER_FOLLOW_API_URL = buildApiUrl(FOLLOW_USER_CUSTOM_ID);
