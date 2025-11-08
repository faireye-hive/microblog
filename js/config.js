//import { loggedInUser } from "./state.js";

export const APP_ID = "micro.fair";
export const ADMIN = "faireye";
export const VOTE_CUSTOM_ID = `${APP_ID}.interation`;
export const ADMIN_PMUTE_CUSTOM_ID = `${APP_ID}.adpmuted`;
export const BLOCK_USER_CUSTOM_ID = `${APP_ID}.{user}.block`;



const API = "https://hafsql-api.mahdiyari.info/operations/custom_json";

export const API_URL = `${API}/${APP_ID}?limit=1000`;
export const VOTE_API_URL = `${API}/${VOTE_CUSTOM_ID}?limit=1000`; // NOVO: URL da API de votos
export const ADMIN_POST_MUTE_API_URL = `${API}/${ADMIN_PMUTE_CUSTOM_ID}?limit=1000`;
export const USER_BLOCK_API_URL = `${API}/${BLOCK_USER_CUSTOM_ID}?limit=1000`;
