// Copia de nombre → Slack member ID, tomada del organigrama (ORG) que vive en
// index.html. Se duplica acá porque esta función corre en el servidor y no
// puede importar código del frontend. Si sumás o cambiás Slack IDs en el
// organigrama de la app, actualizá también este archivo a mano.

const NAME_TO_SLACK = {
  "Carlos Fonseca": "UCCK61S2X",
  "Marcelo Sosa": "U04EA2034",
  "Georgina Zunino": "U018S9LBF47",
  "Zoé Natera": "U04URJBBZ8F",
  "Melisa Díaz": "U06B6FC9G6B",
  "Antonella Cachambú": "U056RQS4BTM",
  "Augusto Kohler": "U08LK7C6WQ1",
  "Delfina Jorge": "U02SQ5JR58B",
  "Fernando Gregoris": "U2KBDC6FK",
  "Milagros Delfino": "U07784X8ESJ",
  "Ricardo Franco": "U083XDQTC56",
  "Diego Álvarez": "U2CKGQUKV",
  "Agustín Serra": "U08H1J7FW75",
  "Bruno Alaminos": "UCDRHJE9M",
  "Camila Calcagno": "U09CWS7DMPF",
  "Cristián Álvarez": "U04E9E08A",
  "Damián Morales": "UCBCTM72M",
  "Facundo Yobstraibizer": "U05F82DJ4J1",
  "Federico Franco": "UCDP4C1CP",
  "Francisco García": "U01DX7PLG90",
  "Franco Lorio": "U01JLASEE07",
  "Germán Álvarez": "U01CPP0KQTB",
  "Juan Antuña": "U080E21UDPW",
  "Juan González": "UC9CW236C",
  "Lucas Salzotto": "U07CURQKF7T",
  "Matías Gómez": "U02H3FYFRSM",
  "Tobías Irastorza": "U0314FC3P5H",
  "Valentín Cardozo": "U01KMCNTJ1H",
  "Natalia Maffini": "UCE1ZQ28N",
  "Agustina Navazzotti": "U03RY0JK5V2",
  "Franco Muñiz": "U03FTCH3N1G",
  "Lucía González": "U083MFGQKK5",
  "Mateo Formia": "U07693JKEFP",
  "Mauro Herrera": "U02DCBY2GHF",
  "Nicolás Palazesi": "U018W2FLAKA",
  "Victoria Pérez": "UCCFEKNDA",
  "Josefina Amin": "U0337D6F83D",
  "Lucia Robledo": "U05QFRJE4G7",
  "Alejandra Gregoris": "U025Q8FHRME",
  "Gonzalo Sosa": "U01V1Q5S61G",

  // Incorporaciones recientes, todavía sin cargar en el organigrama público.
  "Francisco Barosco": "U0BTY5Q9L57",
  "Alejandra Orozco": "U0BTZU40T0C",
  "Ale": "U0BTZU40T0C", // puso solo "Ale" como su nombre en la plataforma
};

function normName(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Busca por nombre normalizado, con fallback a "todas las palabras del
// nombre del organigrama están contenidas en el nombre buscado" (mismo
// criterio que usa la app en el frontend).
function findSlackIdByName(name) {
  const nn = normName(name);
  if (!nn) return null;
  for (const [orgName, slackId] of Object.entries(NAME_TO_SLACK)) {
    const norm = normName(orgName);
    if (norm === nn) return slackId;
  }
  for (const [orgName, slackId] of Object.entries(NAME_TO_SLACK)) {
    const parts = orgName.split(' ').map(normName);
    if (parts.every((p) => nn.includes(p))) return slackId;
  }
  return null;
}

module.exports = { NAME_TO_SLACK, findSlackIdByName };
