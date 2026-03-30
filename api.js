import 'dotenv/config';

const BASE_URL = 'https://api.eclesiar.com';

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Authorization': process.env.ECLESIAR_API_TOKEN,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  if (json.code !== 200) throw new Error(json.description || 'Unknown API error');
  return json.data;
}

export const api = {
  serverStatus: () => apiFetch('/server/status'),
  serverItems: (page = 1) => apiFetch(`/server/items?page=${page}`),
  serverEquipments: (page = 1) => apiFetch(`/server/equipments?page=${page}`),
  account: (account_id) => apiFetch(`/account?account_id=${account_id}`),
  myEquipments: (page = 1) => apiFetch(`/account/mine/equipments?page=${page}`),
  countryStats: (statistic) => apiFetch(`/statistics/country?statistic=${statistic}`),
  countries: () => apiFetch('/countries'),
  auctions: (finished = 0, page = 1) => apiFetch(`/market/auctions/get?finished=${finished}&page=${page}`),
  marketItems: (country_id, item_id, page = 1) => apiFetch(`/market/items/get?country_id=${country_id}&item_id=${item_id}&page=${page}`),
  wars: ({ event_wars = 0, extra_details = 0, expired = 0, war_id = 0, page = 1 } = {}) =>
    apiFetch(`/wars?event_wars=${event_wars}&extra_details=${extra_details}&expired=${expired}&war_id=${war_id}&page=${page}`),
  warRounds: (war_id) => apiFetch(`/war/rounds?war_id=${war_id}`),
  warRoundHits: (war_round_id, page = 1) => apiFetch(`/war/round/hits?war_round_id=${war_round_id}&page=${page}`),
};