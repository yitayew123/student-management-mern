const fs = require("node:fs");
const path = require("node:path");
const yaml = require("yaml");
const swaggerUi = require("swagger-ui-express");

const swaggerFilePath = path.join(__dirname, "../../docs/swagger.yaml");

const swaggerDocument = yaml.parse(fs.readFileSync(swaggerFilePath, "utf8"));

module.exports = {
  swaggerUi,
  swaggerDocument,
};
