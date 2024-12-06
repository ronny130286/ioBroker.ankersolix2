"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var utils = __toESM(require("@iobroker/adapter-core"));
var import_fs = __toESM(require("fs"));
var import_api = require("./api");
class Ankersolix2 extends utils.Adapter {
  storeData = "";
  refreshTimeout;
  loginData;
  api;
  constructor(options = {}) {
    super({
      ...options,
      name: "ankersolix2"
    });
    this.storeData = utils.getAbsoluteInstanceDataDir(this) + "/session.data";
    this.loginData = null;
    this.refreshTimeout = null;
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    if (!this.config.Username || !this.config.Password) {
      this.log.error(
        `User name and/or user password empty - please check instance configuration of ${this.namespace}`
      );
      return;
    }
    if (!this.config.POLL_INTERVAL || this.config.POLL_INTERVAL < 10) {
      this.log.error(
        `The poll intervall must be greater than 10 - please check instance configuration of ${this.namespace}`
      );
      return;
    }
    try {
      if (!import_fs.default.existsSync(utils.getAbsoluteInstanceDataDir(this))) {
        import_fs.default.mkdirSync(utils.getAbsoluteInstanceDataDir(this));
        this.log.debug("Folder created: " + this.storeData);
      }
    } catch (err) {
      this.log.error(
        "Could not create storage directory (" + utils.getAbsoluteInstanceDataDir(this) + "): " + err
      );
      return;
    }
    this.api = new import_api.SolixApi({
      username: this.config.Username,
      password: this.config.Password,
      country: this.config.COUNTRY,
      log: this.log
    });
    this.refreshDate();
  }
  async loginAPI() {
    var _a;
    let login = await this.restoreLoginData();
    if (!this.isLoginValid(login)) {
      this.log.debug("loginAPI: token expires");
      login = null;
    }
    if (login == null) {
      try {
        const loginResponse = await this.api.login();
        login = (_a = loginResponse.data) != null ? _a : null;
        if (login && loginResponse.code == 0) {
          this.log.debug("LoginRsponseCode: " + loginResponse.code);
          await this.storeLoginData(login);
        }
      } catch (error) {
        this.log.error("loginAPI: " + error.message);
        const status = error.status;
        if (status == 401) {
          if (import_fs.default.existsSync(this.storeData)) {
            import_fs.default.unlinkSync(this.storeData);
          }
          this.terminate("Credentials are wrong, please check and restart", status);
        }
        return null;
      }
    } else {
      this.log.debug("Using auth data from savefile");
    }
    return login;
  }
  async storeLoginData(data) {
    this.log.debug("Write Data to File");
    await import_fs.promises.writeFile(this.storeData, JSON.stringify(data), "utf-8");
  }
  async restoreLoginData() {
    try {
      this.log.debug("Try to restore data from File");
      const data = await import_fs.promises.readFile(this.storeData, "utf8");
      return JSON.parse(data);
    } catch (err) {
      if (err.code === "ENOENT") {
        this.log.error("RestoreLoginData: " + err.message);
        return null;
      } else {
        this.log.error("RestoreLoginData: " + err.message);
        return null;
      }
    }
  }
  async refreshDate() {
    try {
      this.loginData = await this.loginAPI();
      await this.fetchAndPublish();
    } catch (err) {
      this.log.error("Failed fetching or publishing printer data, Error: " + err);
      this.log.debug(`Error Object: ${JSON.stringify(err)}`);
    } finally {
      if (this.refreshTimeout) {
        this.log.debug("refreshTimeout: " + this.refreshTimeout.id);
        this.clearTimeout(this.refreshTimeout);
      }
      this.refreshTimeout = this.setTimeout(() => {
        this.refreshTimeout = null;
        this.refreshDate();
      }, this.config.POLL_INTERVAL * 1e3);
      this.log.debug(`Sleeping for ${this.config.POLL_INTERVAL * 1e3}ms... TimerId ${this.refreshTimeout}`);
    }
  }
  async fetchAndPublish() {
    const loggedInApi = await this.api.withLogin(this.loginData);
    const siteHomepage = await loggedInApi.siteHomepage();
    let sites;
    if (siteHomepage.data.site_list.length === 0) {
      sites = (await loggedInApi.getSiteList()).data.site_list;
    } else {
      sites = siteHomepage.data.site_list;
    }
    for (const site of sites) {
      const scenInfo = await loggedInApi.scenInfo(site.site_id);
      const message = JSON.stringify(scenInfo.data);
      const jsonparse = JSON.parse(message);
      this.CreateOrUpdate(site.site_id, jsonparse.home_info.home_name, "device");
      this.CreateOrUpdate(
        site.site_id + ".EXTRA.RAW_JSON",
        "RAW_JSON",
        "state",
        "string",
        "value",
        false,
        "undefined"
      );
      await this.setState(site.site_id + ".EXTRA.RAW_JSON", { val: message, ack: true });
      Object.entries(jsonparse).forEach((entries) => {
        const [id, value] = entries;
        const type = this.whatIsIt(value);
        const key = site.site_id + "." + id;
        if (type === "object") {
          this.isObject(key, value);
        } else if (type === "array") {
          const array = JSON.parse(JSON.stringify(value));
          let i = 0;
          array.forEach((elem, item) => {
            if (this.whatIsIt(array[item]) === "object") {
              this.isObject(key + "." + i, array[item]);
            } else if (this.whatIsIt(array[item]) === "string") {
              this.isString(key + "." + i, array[item]);
            }
            i++;
          });
        } else {
          this.isString(key, value);
        }
      });
    }
    this.log.debug("Published.");
  }
  whatIsIt(obj) {
    if (obj === null) {
      return "null";
    }
    if (obj === void 0) {
      return "undefined";
    }
    if (Array.isArray(obj)) {
      return "array";
    }
    if (typeof obj === "string") {
      return "string";
    }
    if (typeof obj === "boolean") {
      return "boolean";
    }
    if (typeof obj === "number") {
      return "number";
    }
    if (obj != null && typeof obj === "object") {
      return "object";
    }
  }
  isArray(key, value) {
    const array = JSON.parse(JSON.stringify(value));
    array.forEach(async (elem, item) => {
      const type = this.whatIsIt(array[item]);
      if (type === "object") {
        this.isObject(key, array[item]);
      } else if (type === "string") {
        this.isString(key, array[item]);
      }
    });
  }
  isObject(key, value) {
    var _a;
    const name = (_a = key.split(".").pop()) == null ? void 0 : _a.replaceAll("_", " ");
    this.CreateOrUpdate(key, name, "folder");
    Object.entries(value).forEach((subentries) => {
      const [objkey, objvalue] = subentries;
      const type = this.whatIsIt(objvalue);
      if (type === "array") {
        this.isArray(key + "." + objkey, objvalue);
      } else if (type === "object") {
        this.isObject(key + "." + objkey, objvalue);
      } else {
        this.isString(key + "." + objkey, objvalue);
      }
    });
  }
  async isString(key, value) {
    var _a;
    let parmType = "string";
    let parmRole = "value";
    let parmUnit = void 0;
    const valType = this.whatIsIt(value);
    if (valType === "boolean") {
      parmType = "boolean";
    }
    if (valType === "number") {
      parmType = "number";
    }
    if (key.includes("time") && !key.includes("backup_info")) {
      parmType = "string";
      parmRole = "value.time";
      if (key.includes("create")) {
        value = new Date(value * 1e3).toUTCString();
      } else if (key.includes("update")) {
        value = (/* @__PURE__ */ new Date()).getTime().toString();
      }
    }
    if (key.includes("_power") && !key.includes("display") && !key.includes("battery")) {
      parmType = "number";
      value = +value;
      parmUnit = "W";
    }
    if (key.includes("battery_power")) {
      parmRole = "value.fill";
      parmUnit = "%";
      parmType = "number";
      if (key.includes("total_battery_power")) {
        value = +value * 100;
      } else {
        value = +value;
      }
    }
    if (key.includes("unit")) {
      switch (value) {
        case "kWh":
        case "W":
          parmRole = "value.energy";
          break;
      }
    }
    const name = (_a = key.split(".").pop()) == null ? void 0 : _a.replaceAll("_", " ");
    await this.CreateOrUpdate(key, name, "state", parmType, parmRole, false, parmUnit);
    await this.setState(key, { val: value, ack: true });
  }
  async CreateOrUpdate(path, name = "Error", type, commontype = void 0, role = void 0, writable = void 0, unit = void 0, min = void 0, max = void 0, step = void 0) {
    const obj = await this.getObjectAsync(path);
    if (obj == null) {
      let newObj = null;
      if (type === "state") {
        newObj = {
          type,
          common: {
            name,
            type: commontype,
            role,
            read: true,
            write: writable,
            unit,
            min,
            max,
            step
          },
          native: {}
        };
      } else {
        newObj = {
          type,
          common: { name },
          native: {}
        };
      }
      await this.setObjectAsync(path, newObj);
    } else {
      let changed = false;
      if (type === "state") {
        if (obj.common.name != name) {
          obj.common.name = name;
          changed = true;
        }
        if (obj.common.type != commontype) {
          obj.common.type = commontype;
          changed = true;
        }
        if (obj.common.role != role) {
          obj.common.role = role;
          changed = true;
        }
        if (obj.common.read != true) {
          obj.common.read = true;
          changed = true;
        }
        if (obj.common.write != writable) {
          obj.common.write = writable;
          changed = true;
        }
        if (obj.common.unit != unit) {
          obj.common.unit = unit;
          changed = true;
        }
        if (obj.common.min != min) {
          obj.common.min = min;
          changed = true;
        }
        if (obj.common.max != max) {
          obj.common.max = max;
          changed = true;
        }
        if (obj.common.step != step) {
          obj.common.step = step;
          changed = true;
        }
      } else {
        if (obj.common.name != name) {
          obj.common.name = name;
          changed = true;
        }
        if (obj.common.type != type) {
          obj.common.type = type;
          changed = true;
        }
      }
      if (changed) {
        await this.setObjectAsync(path, obj);
      }
    }
  }
  getJSON(value) {
    return JSON.parse(JSON.stringify(value));
  }
  isLoginValid(loginData, now = /* @__PURE__ */ new Date()) {
    if (loginData != null) {
      return new Date(loginData.token_expires_at * 1e3).getTime() > now.getTime();
    }
    return false;
  }
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   */
  onUnload(callback) {
    try {
      clearTimeout(this.refreshTimeout);
      callback();
    } catch (e) {
      this.log.error("onUnload: " + e);
      callback();
    }
  }
  // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
  // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
  // /**
  //  * Is called if a subscribed object changes
  //  */
  // private onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void {
  //     if (obj) {
  //         // The object was changed
  //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
  //     } else {
  //         // The object was deleted
  //         this.log.info(`object ${id} deleted`);
  //     }
  // }
  /**
   * Is called if a subscribed state changes
   */
  onStateChange(id, state) {
    if (state) {
      this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
    } else {
      this.log.info(`state ${id} deleted`);
    }
  }
  // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
  // /**
  //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
  //  * Using this method requires "common.messagebox" property to be set to true in io-package.json
  //  */
  // private onMessage(obj: ioBroker.Message): void {
  //     if (typeof obj === 'object' && obj.message) {
  //         if (obj.command === 'send') {
  //             // e.g. send email or pushover or whatever
  //             this.log.info('send command');
  //             // Send response in callback if required
  //             if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
  //         }
  //     }
  // }
}
if (require.main !== module) {
  module.exports = (options) => new Ankersolix2(options);
} else {
  (() => new Ankersolix2())();
}
//# sourceMappingURL=main.js.map
