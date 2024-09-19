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
function isLoginValid(loginData, now = /* @__PURE__ */ new Date()) {
  return new Date(loginData.token_expires_at * 1e3).getTime() > now.getTime();
}
class Ankersolix2 extends utils.Adapter {
  constructor(options = {}) {
    super({
      ...options,
      name: "ankersolix2"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    await this.setObjectNotExistsAsync("testVariable", {
      type: "state",
      common: {
        name: "testVariable",
        type: "boolean",
        role: "indicator",
        read: true,
        write: true
      },
      native: {}
    });
    if (!this.config.S2M_User || !this.config.S2M_Pass) {
      this.log.error(
        `User name and/or user password empty - please check instance configuration of ${this.namespace}`
      );
      return;
    }
    if (!this.config.S2M_POLL_INTERVAL || this.config.S2M_POLL_INTERVAL < 30) {
      this.log.error(
        `The poll intervall must be greater than 30 - please check instance configuration of ${this.namespace}`
      );
      return;
    }
    const storeDir = utils.getAbsoluteInstanceDataDir(this);
    try {
      if (!import_fs.default.existsSync(storeDir)) {
        import_fs.default.mkdirSync(storeDir);
        this.log.info("Folder created: " + storeDir);
      }
    } catch (err) {
      this.log.error("Could not create storage directory (" + storeDir + "): " + err);
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
      const sleepInterval = this.config.S2M_POLL_INTERVAL * 1e3 - end;
      this.log.info(`Sleeping for ${sleepInterval}ms...`);
      await (0, import_utils.sleep)(sleepInterval);
      this.refreshDate();
    }
  }
  async fetchAndPublish() {
    var _a;
    this.log.info("Fetching data");
    const api = new import_api.SolixApi({
      username: this.config.S2M_User,
      password: this.config.S2M_Pass,
      country: this.config.S2M_COUNTRY,
      log: this.log
    });
    const storeDir = utils.getAbsoluteInstanceDataDir(this);
    const persistence = new import_persistence.FilePersistence(storeDir + "/session.data", this.log);
    let loginData = await persistence.retrieve();
    if (loginData == null || !isLoginValid(loginData)) {
      const loginResponse = await api.login();
      loginData = (_a = loginResponse.data) != null ? _a : null;
      if (loginData) {
        await persistence.store(loginData);
      } else {
        this.log.error(`Could not log in: ${loginResponse.msg} (${loginResponse.code})`);
      }
    } else {
      this.log.info("Using cached auth data");
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
        Object.entries(jsonparse).forEach((entries) => {
          const [key, value] = entries;
          const type = this.whatIsIt(value);
          if (type === "object") {
            this.isAnObject(value, key);
          } else if (type === "array") {
            const array = JSON.parse(JSON.stringify(value));
            let i = 0;
            array.forEach((elem, item) => {
              if (this.whatIsIt(array[item]) === "object") {
                this.isAnObject(array[item], key + "." + i);
              } else if (this.whatIsIt(array[item]) === "string") {
                this.isAnString(array[item], key + "." + i);
              }
              i++;
            });
          } else {
            this.isAnString(value, key);
          }
        });
        import_fs.default.writeFileSync(utils.getAbsoluteInstanceDataDir(this) + "/scenInfo.json", message, "utf8");
      }
      this.log.info("Published.");
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
    if (typeof obj === "number" || typeof obj === "bigint") {
      return "number";
    }
    if (obj != null && typeof obj === "object") {
      return "object";
    }
  }
  isAnArray(value, arrayname) {
    const array = JSON.parse(JSON.stringify(value));
    array.forEach(async (elem, item) => {
      const type = this.whatIsIt(array[item]);
      if (type === "object") {
        this.isAnObject(array[item], arrayname);
      } else if (type === "string") {
        this.isAnString(array[item], arrayname);
      }
    });
  }
  isAnObject(value, subname) {
    Object.entries(value).forEach((subentries) => {
      const [subkey, subvalue] = subentries;
      const type = this.whatIsIt(subvalue);
      if (type === "array") {
        this.isAnArray(subvalue, subname + "." + subkey);
      } else {
        this.isAnString(subvalue, subname + "." + subkey);
      }
    });
  }
  async isAnString(value, name) {
    this.log.info("Name: " + name + "ValueTyp: " + typeof value);
    let typeNValue = typeof value;
    let typeObj = "string";
    if (typeNValue === "string") {
      await this.setObjectNotExistsAsync(name, {
        type: "state",
        common: {
          name,
          type: "string",
          role: "value",
          read: true,
          write: false
        },
        native: {}
      }).catch((e) => {
        this.log.error(`setObjectNotExists:${e}`);
      });
    } else if (typeNValue === "boolean") {
      await this.setObjectNotExistsAsync(name, {
        type: "state",
        common: {
          name,
          type: "boolean",
          role: "value",
          read: true,
          write: false
        },
        native: {}
      }).catch((e) => {
        this.log.error(`setObjectNotExists:${e}`);
      });
    } else if (typeNValue === "number") {
      await this.setObjectNotExistsAsync(name, {
        type: "state",
        common: {
          name,
          type: "number",
          role: "value",
          read: true,
          write: false
        },
        native: {}
      }).catch((e) => {
        this.log.error(`setObjectNotExists:${e}`);
      });
    }
    this.setState(name, { val: value, ack: true });
  }
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   */
  onUnload(callback) {
    try {
      callback();
    } catch (e) {
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
