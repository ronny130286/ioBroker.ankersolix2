"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var config_exports = {};
__export(config_exports, {
  anonymizeConfig: () => anonymizeConfig,
  getConfig: () => getConfig
});
module.exports = __toCommonJS(config_exports);
var import_dotenv = require("dotenv");
function stringEnvVar(envVarName, defaultValue) {
  var _a;
  const value = process.env[envVarName];
  if (value == null && defaultValue === void 0) {
    console.error(`Missing env var ${envVarName}`);
    process.exit(1);
  }
  return (_a = value != null ? value : defaultValue) != null ? _a : void 0;
}
function intEnvVar(envVarName, defaultValue) {
  if (defaultValue != null) {
    const value = stringEnvVar(envVarName, null);
    if (value == null) {
      return defaultValue;
    }
    return parseInt(value, 10);
  } else {
    const value = stringEnvVar(envVarName);
    return parseInt(value, 10);
  }
}
function boolEnvVar(envVarName, defaultValue = false) {
  const value = stringEnvVar(envVarName, null);
  if (value == null) {
    return defaultValue;
  }
  return value === "true";
}
function arrayEnvVar(envVarName, defaultValue) {
  if (defaultValue != null) {
    const value = stringEnvVar(envVarName, null);
    if (value == null) {
      return defaultValue;
    }
    return value.split(",");
  } else {
    const value = stringEnvVar(envVarName);
    return value.split(",");
  }
}
function getConfig() {
  (0, import_dotenv.config)();
  return {
    username: stringEnvVar("S2M_USER"),
    password: stringEnvVar("S2M_PASSWORD"),
    country: stringEnvVar("S2M_COUNTRY"),
    loginStore: stringEnvVar("S2M_LOGIN_STORE", "auth.data"),
    pollInterval: intEnvVar("S2M_POLL_INTERVAL", 30),
    mqttUrl: stringEnvVar("S2M_MQTT_URI"),
    mqttClientId: stringEnvVar("S2M_MQTT_CLIENT_ID", "solix2mqtt"),
    mqttUsername: stringEnvVar("S2M_MQTT_USERNAME", null),
    mqttPassword: stringEnvVar("S2M_MQTT_PASSWORD", null),
    mqttRetain: boolEnvVar("S2M_MQTT_RETAIN"),
    mqttTopic: stringEnvVar("S2M_MQTT_TOPIC", "solix"),
    verbose: boolEnvVar("S2M_VERBOSE", false)
  };
}
function anonymizeConfig(config) {
  const newConfig = { ...config };
  const hideKeys = ["password"];
  for (const key of hideKeys) {
    if (config[key] != null) {
      newConfig[key] = "***";
    }
  }
  return newConfig;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  anonymizeConfig,
  getConfig
});
//# sourceMappingURL=config.js.map
