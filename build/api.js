"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var api_exports = {};
__export(api_exports, {
  DeviceCapacity: () => DeviceCapacity,
  ParamType: () => ParamType,
  SolixApi: () => SolixApi
});
module.exports = __toCommonJS(api_exports);
var import_axios = __toESM(require("axios"));
var import_crypto = require("crypto");
var ParamType = /* @__PURE__ */ ((ParamType2) => {
  ParamType2["SB1_SCHEDULE"] = "4";
  ParamType2["SB2_SCHEDULE"] = "6";
  return ParamType2;
})(ParamType || {});
const DeviceCapacity = {
  A17C0: 1600,
  // SOLIX E1600 Solarbank
  A17C1: 1600,
  // SOLIX E1600 Solarbank 2 Pro
  A17C2: 1600,
  // SOLIX E1600 Solarbank 2 AC
  A17C3: 1600,
  // SOLIX E1600 Solarbank 2 Plus
  A17C5: 2700,
  // SOLIX E2700 Solarbank 3 Pro
  A1720: 256,
  // Anker PowerHouse 521 Portable Power Station
  A1722: 288,
  // SOLIX C300 Portable Power Station
  A1723: 230,
  // SOLIX C200 Portable Power Station
  A1725: 230,
  // SOLIX C200 Portable Power Station
  A1726: 288,
  // SOLIX C300 DC Portable Power Station
  A1727: 230,
  // SOLIX C200 DC Portable Power Station
  A1728: 288,
  // SOLIX C300 X Portable Power Station
  A1751: 512,
  // Anker PowerHouse 535 Portable Power Station
  A1753: 768,
  // SOLIX C800 Portable Power Station
  A1754: 768,
  // SOLIX C800 Plus Portable Power Station
  A1755: 768,
  // SOLIX C800X Portable Power Station
  A1760: 1024,
  // Anker PowerHouse 555 Portable Power Station
  A1761: 1056,
  // SOLIX C1000(X) Portable Power Station
  A1770: 1229,
  // Anker PowerHouse 757 Portable Power Station
  A1771: 1229,
  // SOLIX F1200 Portable Power Station
  A1772: 1536,
  // SOLIX F1500 Portable Power Station
  A1780: 2048,
  // SOLIX F2000 Portable Power Station (PowerHouse 767)
  A1780_1: 2048,
  // Expansion Battery for F2000
  A1780P: 2048,
  // SOLIX F2000 Portable Power Station (PowerHouse 767) with WIFI
  A1781: 2560,
  // SOLIX F2600 Portable Power Station
  A1790: 3840,
  // SOLIX F3800 Portable Power Station
  A1790_1: 3840,
  // SOLIX BP3800 Expansion Battery for F3800
  A5220: 5e3
  // SOLIX X1 Battery module
};
class SolixApi {
  SERVER_PUBLIC_KEY = "04c5c00c4f8d1197cc7c3167c52bf7acb054d722f0ef08dcd7e0883236e0d72a3868d9750cb47fa4619248f3d83f0f662671dadc6e2d31c2f41db0161651c7c076";
  username;
  password;
  country;
  timezone;
  ecdh = (0, import_crypto.createECDH)("prime256v1");
  log;
  server;
  constructor(options) {
    var _a;
    this.username = options.username;
    this.password = options.password;
    this.log = (_a = options.log) != null ? _a : console;
    this.server = options.server;
    this.country = options.country.toUpperCase();
    this.timezone = this.getTimezoneGMTString();
    this.ecdh.generateKeys();
  }
  md5(s) {
    return (0, import_crypto.createHash)("md5").update(Buffer.from(s)).digest("hex");
  }
  getTimezoneGMTString() {
    const tzo = -(/* @__PURE__ */ new Date()).getTimezoneOffset();
    const dif = tzo >= 0 ? "+" : "-";
    return `GMT${dif}${this.pad(tzo / 60)}:${this.pad(tzo % 60)}`;
  }
  pad(num) {
    const norm = Math.floor(Math.abs(num));
    return `${norm < 10 ? "0" : ""}${norm}`;
  }
  encryptAPIData(data, key) {
    const cipher = (0, import_crypto.createCipheriv)("aes-256-cbc", key, key.slice(0, 16));
    return cipher.update(data, "utf8", "base64") + cipher.final("base64");
  }
  async axios(endpoint, data, headers) {
    const urlBuilder = new URL(endpoint, this.server);
    const url = urlBuilder.href;
    return (0, import_axios.default)({
      method: "POST",
      url,
      data: data != null ? JSON.stringify(data) : void 0,
      headers: {
        ["Content-Type"]: "application/json",
        Country: this.country,
        Timezone: this.timezone,
        ["Model-Type"]: "DESKTOP",
        ["App-Name"]: "anker_power",
        ["Os-Type"]: "android",
        ...headers
      },
      timeout: 1e4
    });
  }
  withLogin(login) {
    const headers = {
      ["X-Auth-Token"]: login.auth_token,
      gtoken: this.md5(login.user_id)
    };
    const authFetch = async (endpoint, data) => {
      const response = await this.axios(endpoint, data, headers);
      return await response.data;
    };
    return {
      getRelateAndBindDevices: async () => {
        const data = {};
        return authFetch("/power_service/v1/app/get_relate_and_bind_devices", data);
      },
      getUserMqttInfo: async () => {
        return authFetch("/app/devicemanage/get_user_mqtt_info");
      },
      siteHomepage: async () => {
        const data = {};
        return authFetch("/power_service/v1/site/get_site_homepage", data);
      },
      getSiteList: async () => {
        const data = {};
        return authFetch("/power_service/v1/site/get_site_list", data);
      },
      getHomeLoadChart: async (siteId, deviceSn) => {
        const data = { site_id: siteId, device_sn: deviceSn };
        return authFetch("/power_service/v1/site/get_home_load_chart", data);
      },
      scenInfo: async (siteId) => {
        const data = { site_id: siteId };
        return authFetch("/power_service/v1/site/get_scen_info", data);
      },
      energyAnalysis: async (siteId, deviceSn, type, startTime, endTime, deviceType) => {
        if (startTime == null) {
          startTime = /* @__PURE__ */ new Date();
        }
        if (deviceType == null) {
          deviceType = "solar_production";
        }
        const startTimeString = `${startTime.getFullYear()}-${this.pad(startTime.getMonth() + 1)}-${this.pad(startTime.getDate())}`;
        const endTimeString = endTime != null ? `${endTime.getFullYear()}-${this.pad(endTime.getMonth() + 1)}-${this.pad(endTime.getDate())}` : "";
        const data = {
          site_id: siteId,
          device_sn: deviceSn,
          type,
          start_time: startTimeString,
          device_type: deviceType,
          end_time: endTimeString
        };
        return authFetch("/power_service/v1/site/energy_analysis", data);
      },
      getSiteDeviceParam: async (paramType, siteId) => {
        const data = { site_id: siteId, param_type: paramType };
        const response = await authFetch(
          "/power_service/v1/site/get_site_device_param",
          data
        );
        if (response.data != null) {
          switch (paramType) {
            case "4" /* SB1_SCHEDULE */:
              return {
                ...response,
                data: {
                  param_data: JSON.parse(response.data.param_data)
                }
              };
            default:
              return response;
          }
        }
        return response;
      },
      setSiteDeviceParam: async (paramType, siteId, cmd = 17, paramData) => {
        let data = {
          site_id: siteId,
          param_type: paramType,
          cmd,
          param_data: paramData
        };
        switch (paramType) {
          case "4" /* SB1_SCHEDULE */:
            data = { ...data, param_data: JSON.stringify(paramData) };
            break;
          default:
        }
        return authFetch("/power_service/v1/site/set_site_device_param", data);
      }
    };
  }
  async login() {
    const data = {
      ab: this.country,
      client_secret_info: {
        public_key: this.ecdh.getPublicKey("hex")
      },
      enc: 0,
      email: this.username,
      password: this.encryptAPIData(
        this.password,
        this.ecdh.computeSecret(Buffer.from(this.SERVER_PUBLIC_KEY, "hex"))
      ),
      time_zone: (/* @__PURE__ */ new Date()).getTimezoneOffset() !== 0 ? -(/* @__PURE__ */ new Date()).getTimezoneOffset() * 60 * 1e3 : 0,
      transaction: `${(/* @__PURE__ */ new Date()).getTime()}`
    };
    const response = await this.axios("/passport/login", data);
    return await response.data;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DeviceCapacity,
  ParamType,
  SolixApi
});
//# sourceMappingURL=api.js.map
