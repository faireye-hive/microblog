export const APP_ID = "micro.fair";
export const VOTE_CUSTOM_ID = `${APP_ID}.interation`;
const API = "https://hafsql-api.mahdiyari.info/operations/custom_json";

export const API_URL = `${API}/${APP_ID}?limit=1000`;
export const VOTE_API_URL = `${API}/${VOTE_CUSTOM_ID}?limit=1000`; // NOVO: URL da API de votos