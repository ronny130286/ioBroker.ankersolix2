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
var import_api = require("./api.js");
var import_persistence = require("./persistence.js");
var import_utils = require("./utils.js");
class Ankersolix2 extends utils.Adapter {
  storeDir = "";
  sleepInterval;
  constructor(options = {}) {
    super({
      ...options,
      name: "ankersolix2"
    });
    this.storeDir = utils.getAbsoluteInstanceDataDir(this);
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
    if (!this.config.POLL_INTERVAL || this.config.POLL_INTERVAL < 30) {
      this.log.error(
        `The poll intervall must be greater than 30 - please check instance configuration of ${this.namespace}`
      );
      return;
    }
    try {
      if (!import_fs.default.existsSync(this.storeDir)) {
        import_fs.default.mkdirSync(this.storeDir);
        this.log.debug("Folder created: " + this.storeDir);
        (0, import_utils.sleep)(2e3);
      }
    } catch (err) {
      this.log.error("Could not create storage directory (" + this.storeDir + "): " + err);
      return;
    }
    this.refreshDate();
  }
  async refreshDate() {
    const start = (/* @__PURE__ */ new Date()).getTime();
    try {
      await this.fetchAndPublish();
    } catch (e) {
      this.log.warn("Failed fetching or publishing printer data" + e);
    } finally {
      const end = (/* @__PURE__ */ new Date()).getTime() - start;
      this.sleepInterval = this.config.POLL_INTERVAL * 1e3 - end;
      this.log.debug(`Sleeping for ${this.sleepInterval}ms...`);
      await (0, import_utils.sleep)(this.sleepInterval);
      this.refreshDate();
    }
  }
  async fetchAndPublish() {
    var _a;
    this.log.debug("Fetching data");
    const api = new import_api.SolixApi({
      username: this.config.Username,
      password: this.config.Password,
      country: this.config.COUNTRY,
      log: this.log
    });
    const persistence = new import_persistence.FilePersistence(
      this.storeDir + "/session.data",
      this.log
    );
    let loginData = await persistence.retrieve();
    if ((loginData == null ? void 0 : loginData.email) != this.config.Username || (loginData == null ? void 0 : loginData.auth_token) == null || (loginData == null ? void 0 : loginData.token_expires_at) == null) {
      loginData = null;
    }
    if (loginData == null || !this.isLoginValid(loginData)) {
      const loginResponse = await api.login();
      loginData = (_a = loginResponse.data) != null ? _a : null;
      if (loginData && loginResponse.code == 0) {
        await persistence.store(loginData);
      } else {
        this.log.error(`${loginResponse.msg} (${loginResponse.code})`);
      }
    } else {
      this.log.debug("Using cached auth data");
    }
    if (loginData) {
      const loggedInApi = api.withLogin(loginData);
      const siteHomepage = await loggedInApi.siteHomepage();
      this.log.debug("siteHomepage Data: " + JSON.stringify(siteHomepage.data.site_list));
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
        this.CreateOrUpdateFolder(site.site_id, jsonparse.home_info.home_name, "device");
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
    } else {
      this.log.error("Not logged in");
    }
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
    this.CreateOrUpdateFolder(key, name, "folder");
    Object.entries(value).forEach((subentries) => {
      const [objkey, objvalue] = subentries;
      const type = this.whatIsIt(objvalue);
      if (type === "array") {
        this.isArray(key + "." + objkey, objvalue);
      } else {
        this.isString(key + "." + objkey, objvalue);
      }
    });
  }
  async isString(key, value) {
    var _a;
    let parmType = "string";
    let parmRole = "value";
    const valType = this.whatIsIt(value);
    if (valType === "boolean") {
      parmType = "boolean";
    }
    if (valType === "number") {
      parmType = "number";
    }
    if (key.includes("time")) {
      parmType = "string";
      parmRole = "value.time";
      if (valType === "number") {
        value = new Date(value * 1e3).toUTCString();
      }
    }
    if (key.includes("unit")) {
      switch (value) {
        case "kWh":
          parmRole = "value.energy";
          break;
        case "W":
          parmRole = "value.energy";
          break;
        default:
          break;
      }
    }
    let parmUnit = void 0;
    if (key.includes("_power") && !key.includes("display")) {
      parmUnit = "W";
    }
    if (key.includes("total_battery_power")) {
      value = value * 100;
      parmRole = "value.fill";
      parmUnit = "%";
      parmType = "number";
    }
    const name = (_a = key.split(".").pop()) == null ? void 0 : _a.replaceAll("_", " ");
    await this.CreateOrUpdateState(key, name, parmType, parmRole, false, parmUnit);
    this.setState(key, { val: value, ack: true });
  }
  async CreateOrUpdateFolder(path, name = "error", type) {
    const obj = await this.getObjectAsync(path);
    if (obj == null) {
      const newObj = {
        type,
        common: { name },
        native: {}
      };
      await this.setObjectAsync(path, newObj);
    } else {
      let changed = false;
      if (obj.common.name != name) {
        obj.common.name = name;
        changed = true;
      }
      if (obj.common.type != type) {
        obj.common.type = type;
        changed = true;
      }
      if (changed) {
        this.log.debug(path + " => has been updated");
        await this.setObjectAsync(path, obj);
      }
    }
  }
  async CreateOrUpdateState(path, name = "Error", type, role, writable, unit = void 0, min = void 0, max = void 0, step = void 0) {
    const obj = await this.getObjectAsync(path);
    if (obj == null) {
      this.log.debug(path + " doesnt exist => create");
      const newObj = {
        type: "state",
        common: {
          name,
          type,
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
      await this.setObjectAsync(path, newObj);
    } else {
      this.log.debug(path + " exist => looking for update");
      let changed = false;
      if (obj.common == null) {
        obj.common = {
          name,
          type: "string",
          role,
          read: true,
          write: writable,
          unit,
          min,
          max,
          step
        };
        changed = true;
      } else {
        if (obj.common.name != name) {
          obj.common.name = name;
          changed = true;
        }
        if (obj.common.type != type) {
          obj.common.type = type;
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
        if (changed) {
          this.log.debug(path + " => has been updated");
          await this.setObjectAsync(path, obj);
        }
      }
    }
  }
  getJSON(value) {
    return JSON.parse(JSON.stringify(value));
  }
  isLoginValid(loginData, now = /* @__PURE__ */ new Date()) {
    return new Date(loginData.token_expires_at * 1e3).getTime() > now.getTime();
  }
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   */
  onUnload(callback) {
    try {
      clearTimeout(this.sleepInterval);
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
