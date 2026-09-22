// Capa dinámica sobre app.json. Solo añade lo que depende del entorno:
// el google-services.json de Firebase (push en Android) puede venir como
// fichero local (ignorado por git) o como variable de entorno de tipo
// fichero en EAS (GOOGLE_SERVICES_JSON). Si no hay ninguno, la build sale
// igual pero los push no llegan (ver docs/PLAY-STORE.md §Firebase).
//
// CommonJS a propósito: mobile/package.json no declara "type": "module".
const fs = require("node:fs");
const path = require("node:path");

module.exports = ({ config }) => {
  const fromEnv = process.env.GOOGLE_SERVICES_JSON;
  const local = path.join(__dirname, "google-services.json");
  const googleServicesFile =
    fromEnv && fs.existsSync(fromEnv)
      ? fromEnv
      : fs.existsSync(local)
        ? "./google-services.json"
        : undefined;

  return {
    ...config,
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
