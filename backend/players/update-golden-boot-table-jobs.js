const cron = require("node-cron");
import { updateFantasyTeamsWithPlayerStats } from "./insert-fantasy-players";

cron.schedule(
  "*/5 12-23 * * 6,0",
  () => {
    updateFantasyTeamsWithPlayerStats(fantasyTeams);
  },
  {
    scheduled: true,
    timezone: "America/Chicago",
  }
);

cron.schedule(
  "0 0 * * 1-5",
  () => {
    updateFantasyTeamsWithPlayerStats(fantasyTeams);
  },
  {
    scheduled: true,
    timezone: "America/Chicago",
  }
);

const fantasyTeams = {
  "Messitopia (Michael)": {
    Messi: 1387,
    Ebobisse: 1652,
    Gil: 1201,
    FacundoTorres: 1258,
    Puig: 1403,
  },
  "No Ferraris FC (Mike)": {
    Cucho: 1284,
    White: 1233,
    Hlongwane: 1760,
    Paintsil: 2167,
    Uhre: 1174,
  },
  "WolffOut Pack (Taylor)": {
    Bouanga: 1006,
    Musa: 1328,
    Arango: 1099,
    Mihailovic: 1471,
    Mijatović: 2164,
  },
  "Diamond Dogs (Chris W.)": {
    Giakoumakis: 1087,
    Pulido: 1678,
    Gauld: 1230,
    Cuypers: 2145,
    Pec: 1418,
  },
  Bryan: {
    Boupendza: 1799,
    Muriel: 2169,
    Klauss: 1034,
    Vanzeir: 1147,
    Campana: 1367,
  },
  "Chris H.": {
    Mukhtar: 1055,
    Pukki: 1769,
    Pellegrino: 2147,
    Almada: 1078,
    Chancalay: 1218,
  },
  "The Rodney Redes Experience (Chris V.)": {
    Espinoza: 1649,
    Taylor: 1364,
    "De La Vega": 1355,
    Evander: 1742,
    Luna: 1111,
  },
  Derek: {
    Acosta: 1783,
    "Jesus Ferreira": 1307,
    Morris: 1347,
    Lobjanidze: 1093,
    Copetti: 1522,
  },
  "Poontown Ramblers (Jeremiah)": {
    Benteke: 1597,
    Gazdag: 1167,
    Obrian: 1464,
    Joveljić: 1407,
    Coccaro: 1636,
  },
  "The Alan Jackson Five (Landon)": {
    Carranza: 1175,
    Rossi: 1292,
    Forsberg: 1154,
    Rubio: 1815,
    Olivera: 1014,
  },
  Marc: {
    Suarez: 1392,
    Driussi: 1461,
    Reynoso: 1753,
    Martinez: 2017,
    Mcguire: 1268,
  },
};
