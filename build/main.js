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
var import_apitypes = require("./apitypes");
var import_func = require("./func");
class Ankersolix2 extends utils.Adapter {
  storeData = "";
  refreshTimeout;
  refreshAnalysisTimeout;
  loginData;
  api;
  apiConnection;
  sleep;
  isAdmin = false;
  loggedInApi;
  myfunc;
  constructor(options = {}) {
    super({
      ...options,
      name: "ankersolix2"
    });
    this.storeData = `${utils.getAbsoluteInstanceDataDir(this)}/session.json`;
    this.loginData = null;
    this.refreshTimeout = null;
    this.refreshAnalysisTimeout = null;
    this.sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    this.api = null;
    this.apiConnection = false;
    this.myfunc = new import_func.MyFunc(this);
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    var _a;
    this.loginData = await this.loginAPI();
    if (typeof this.config.HomeLoadID === "string" && this.config.HomeLoadID.trim() !== "") {
      if (this.config.EnableControlDP) {
        this.subscribeForeignStates(`${this.config.HomeLoadID}`);
      }
      if (this.config.EnableACLoading) {
        this.subscribeForeignStates(`${this.namespace}.control.ACLoading`);
      }
      if (this.config.EnableCustomPowerPlan && ((_a = this.config.PowerPlan) == null ? void 0 : _a.length) > 0) {
        this.subscribeForeignStates(`${this.namespace}.control.SetPowerplan`);
        if (this.config.PowerPlanAtReload) {
          this.setPowerplan();
        }
      }
    }
    if (!this.config.Username || !this.config.Password) {
      this.log.error(
        `User name and/or user password empty - please check instance configuration of ${this.namespace}`
      );
      return;
    }
    if (!this.config.POLL_INTERVAL && (this.config.POLL_INTERVAL < 10 || this.config.POLL_INTERVAL > 3600)) {
      this.log.error(
        `The poll intervall must be between 10 and 3600 secounds - please check instance configuration of ${this.namespace}`
      );
      return;
    }
    try {
      if (!import_fs.default.existsSync(utils.getAbsoluteInstanceDataDir(this))) {
        import_fs.default.mkdirSync(utils.getAbsoluteInstanceDataDir(this));
        this.log.debug(`Folder created: ${this.storeData}`);
      }
    } catch (err) {
      this.log.error(`Could not create storage directory (${utils.getAbsoluteInstanceDataDir(this)}): ${err}`);
      return;
    }
    this.refreshDate();
    if (this.config.AnalysisGrid || this.config.AnalysisHomeUsage || this.config.AnalysisSolarproduction) {
      this.refreshAnalysis();
    }
  }
  async loginAPI() {
    var _a;
    const country = this.config.API_Server === "https://ankerpower-api-eu.anker.com" ? this.config.COUNTRY : this.config.COUNTRY2;
    this.api = new import_api.SolixApi({
      username: this.config.Username,
      password: this.config.Password,
      server: this.config.API_Server,
      country,
      log: this.log
    });
    let login = await this.restoreLoginData();
    if (login) {
      let newneed = false;
      if (!this.myfunc.isLoginValid(login)) {
        this.log.debug("loginAPI: token expired");
        newneed = true;
      }
      if ((login == null ? void 0 : login.email) !== this.config.Username) {
        this.log.debug("loginAPI: username are different");
        newneed = true;
      }
      if (newneed) {
        login = null;
      }
    }
    if (login == null) {
      try {
        const loginResponse = await this.api.login();
        login = (_a = loginResponse.data) != null ? _a : null;
        this.log.debug(`LoginResponseCode: ${loginResponse.code} => ${loginResponse.msg}`);
        if (login && loginResponse.code == 0) {
          this.log.debug(`Write data to file`);
          await import_fs.promises.writeFile(this.storeData, JSON.stringify(login), "utf-8");
        }
      } catch (error) {
        this.log.error(`loginAPI: ${error.message}`);
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
    this.loggedInApi = await this.api.withLogin(login);
    const bindedDevice = await this.loggedInApi.bind_device();
    if (bindedDevice.data.data.length > 0) {
      this.isAdmin = true;
    } else {
      this.isAdmin = false;
    }
    return login;
  }
  async restoreLoginData() {
    try {
      this.log.debug("Try to restore data from File");
      const data = await import_fs.promises.readFile(this.storeData, "utf8");
      return JSON.parse(data);
    } catch (err) {
      if (err.code === "ENOENT") {
        this.log.debug(`RestoreLoginData: ${err.message}`);
        return null;
      }
      this.log.debug(`RestoreLoginData: ${err.message}`);
      return null;
    }
  }
  async refreshDate() {
    var _a;
    let refresh = this.config.POLL_INTERVAL;
    try {
      if (!this.myfunc.isLoginValid(this.loginData) || ((_a = this.loginData) == null ? void 0 : _a.email) != this.config.Username) {
        this.loginData = await this.loginAPI();
      }
      if (this.loginData) {
        this.setApiCon(true);
        await this.fetchAndPublish();
      }
    } catch (err) {
      this.log.error(`Failed fetching or publishing printer data, Error: ${err}`);
      this.log.debug(`Error Object: ${JSON.stringify(err)}`);
      this.setApiCon(false);
      refresh = this.config.POLL_INTERVAL * 5;
      if (err.status == 401) {
        if (import_fs.default.existsSync(this.storeData)) {
          import_fs.default.unlinkSync(this.storeData);
        }
        this.terminate("Credentials are wrong, please check and restart", err);
      }
    } finally {
      if (this.refreshTimeout) {
        this.log.debug(`refreshTimeout clear: ${this.refreshTimeout.id}`);
        this.clearTimeout(this.refreshTimeout);
      }
      this.refreshTimeout = this.setTimeout(() => {
        this.refreshTimeout = null;
        this.refreshDate();
      }, refresh * 1e3);
      this.log.debug(`Sleeping for ${refresh * 1e3}ms... TimerId ${this.refreshTimeout}`);
    }
  }
  async refreshAnalysis() {
    var _a;
    try {
      if (!this.myfunc.isLoginValid(this.loginData) || ((_a = this.loginData) == null ? void 0 : _a.email) != this.config.Username) {
        this.loginData = await this.loginAPI();
      }
      if (this.loginData) {
        this.setApiCon(true);
        await this.fetchAndPublishAnalysis();
      }
    } catch (err) {
      this.log.error(`Failed fetching or publishing analysisdata: ${err}`);
      this.log.debug(`Error Object: ${JSON.stringify(err)}`);
      this.setApiCon(false);
    } finally {
      if (this.refreshAnalysisTimeout) {
        this.log.debug(`refreshAnalysisTimeout clear: ${this.refreshAnalysisTimeout.id}`);
        this.clearTimeout(this.refreshAnalysisTimeout);
      }
      this.refreshAnalysisTimeout = this.setTimeout(() => {
        this.refreshAnalysisTimeout = null;
        this.refreshAnalysis();
      }, 600 * 1e3);
      this.log.debug(`Analysis Sleeping for ${600 * 1e3}ms... TimerId ${this.refreshAnalysisTimeout}`);
    }
  }
  async fetchAndPublish() {
    const siteHomepage = await this.loggedInApi.siteHomepage();
    let sites;
    if (siteHomepage.data.site_list.length === 0) {
      sites = (await this.loggedInApi.getSiteList()).data.site_list;
    } else {
      sites = siteHomepage.data.site_list;
    }
    for (const site of sites) {
      const scenInfo = await this.loggedInApi.scenInfo(site.site_id);
      const message = JSON.stringify(scenInfo.data);
      const jsonparse = JSON.parse(message);
      this.CreateOrUpdate(site.site_id, site.site_name, "folder");
      this.CreateOrUpdate(`${site.site_id}.EXTRA`, "EXTRA", "folder");
      await this.CreateOrUpdate(
        `${site.site_id}.EXTRA.RAW_JSON`,
        "RAW_JSON",
        "state",
        "string",
        "value",
        false,
        "undefined"
      );
      this.setState(`${site.site_id}.EXTRA.RAW_JSON`, { val: message, ack: true });
      this.parseObjects(`${site.site_id}`, jsonparse);
    }
    this.log.debug("Published Data.");
  }
  async fetchAndPublishAnalysis() {
    const siteHomepage = await this.loggedInApi.siteHomepage();
    let sites;
    let scenInfo;
    if (siteHomepage.data.site_list.length === 0) {
      sites = (await this.loggedInApi.getSiteList()).data.site_list;
    } else {
      sites = siteHomepage.data.site_list;
    }
    for (const site of sites) {
      const ranges = ["day", "week"];
      scenInfo = !scenInfo ? await this.loggedInApi.scenInfo(site.site_id) : scenInfo;
      const scenInfoData = JSON.parse(JSON.stringify(scenInfo.data));
      this.CreateOrUpdate(`${site.site_id}.energyanalysis`, "energyanalysis", "folder");
      for (const range of ranges) {
        const date = /* @__PURE__ */ new Date();
        const start = range === "week" ? new Date(date.setDate(date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1))) : /* @__PURE__ */ new Date();
        const ende = range === "week" ? new Date(date.setDate(start.getDate() + 6)) : /* @__PURE__ */ new Date();
        if (this.config.AnalysisSolarproduction && (range === "day" && this.config.AnalysisSolarproductionDay || range === "week" && this.config.AnalysisSolarproductionWeek)) {
          try {
            const energyInfo = await this.loggedInApi.energyAnalysis(
              site.site_id,
              "",
              "week",
              start,
              ende,
              "solar_production"
            );
            this.CreateOrUpdate(
              `${site.site_id}.energyanalysis.solar_production`,
              `solar_production`,
              "folder"
            );
            this.CreateOrUpdate(
              `${site.site_id}.energyanalysis.solar_production.${range}`,
              `${range}`,
              "folder"
            );
            const energy_message = JSON.stringify(energyInfo.data);
            this.parseObjects(
              `${site.site_id}.energyanalysis.solar_production.${range}`,
              JSON.parse(energy_message)
            );
            await this.sleep(5e3);
          } catch (err) {
            this.log.debug(`Published Analysis SolarProd ${range} Error: ${err.code}`);
          }
        }
        if (this.config.AnalysisGrid && (range === "day" && this.config.AnalysisGridDay || range === "week" && this.config.AnalysisGridWeek)) {
          try {
            const gridInfo = await this.loggedInApi.energyAnalysis(
              site.site_id,
              "",
              "week",
              start,
              ende,
              "grid"
            );
            this.CreateOrUpdate(`${site.site_id}.energyanalysis.grid`, `grid`, "folder");
            this.CreateOrUpdate(`${site.site_id}.energyanalysis.grid.${range}`, `${range}`, "folder");
            this.parseObjects(
              `${site.site_id}.energyanalysis.grid.${range}`,
              JSON.parse(JSON.stringify(gridInfo.data))
            );
            await this.sleep(5e3);
          } catch (err) {
            this.log.debug(`Published Analysis Grid ${range} Error: ${err.code}`);
          }
        }
        if (this.config.AnalysisHomeUsage && (range === "day" && this.config.AnalysisHomeUsageDay || range === "week" && this.config.AnalysisHomeUsageWeek)) {
          if (scenInfoData.grid_info != null) {
            try {
              for (const i in scenInfoData.grid_info.grid_list) {
                if ("device_sn" in scenInfoData.grid_info.grid_list[i]) {
                  const device_sn = scenInfoData.grid_info.grid_list[i].device_sn;
                  this.CreateOrUpdate(
                    `${site.site_id}.energyanalysis.home_usage`,
                    `home_usage`,
                    "folder"
                  );
                  this.CreateOrUpdate(
                    `${site.site_id}.energyanalysis.home_usage.${device_sn}`,
                    `${device_sn}`,
                    "folder"
                  );
                  this.CreateOrUpdate(
                    `${site.site_id}.energyanalysis.home_usage.${device_sn}.${range}`,
                    `${range}`,
                    "folder"
                  );
                  const homeusageInfo = await this.loggedInApi.energyAnalysis(
                    site.site_id,
                    device_sn,
                    "week",
                    start,
                    ende,
                    "home_usage"
                  );
                  this.parseObjects(
                    `${site.site_id}.energyanalysis.home_usage.${device_sn}.${range}`,
                    JSON.parse(JSON.stringify(homeusageInfo.data))
                  );
                }
              }
              await this.sleep(5e3);
            } catch (err) {
              this.log.debug(`Published Analysis HomeUsage ${range} Error: ${err.code}`);
            }
          } else {
            this.log.debug(
              `Published Analysis HomeUsage ${range} Error: No smart meter found, you can disable it in config of instance`
            );
          }
        }
      }
    }
    this.log.debug("Published Analysis Data.");
  }
  parseObjects(key, jOb) {
    Object.entries(JSON.parse(JSON.stringify(jOb))).forEach((entries) => {
      const [id, value] = entries;
      const type = this.myfunc.whatIsIt(value);
      if (type === "array") {
        this.isArray(`${key}.${id}`, value);
      } else if (type === "object") {
        this.isObject(`${key}.${id}`, value);
      } else {
        this.isString(`${key}.${id}`, value);
      }
    });
  }
  isArray(key, value) {
    const name = key.split(".").pop();
    this.CreateOrUpdate(`${key}`, name, "folder");
    const array = JSON.parse(JSON.stringify(value));
    if (key.includes("statistics")) {
      Object.entries(value).forEach((subentries) => {
        const [objkey, objvalue] = subentries;
        const json = JSON.parse(JSON.stringify(objvalue));
        let role = "value";
        let idname = objkey;
        if (json.type === "1") {
          role = "value.energy";
          idname = "total_energy";
        } else if (json.type === "2") {
          role = "value";
          idname = "total_co2_savings";
        } else if (json.type === "3") {
          role = "value";
          idname = "total_money_savings";
        }
        this.isString(`${key}.${idname}`, json.total, json.unit, role);
      });
    } else {
      let i = "0";
      array.forEach((elem, item) => {
        if ("device_sn" in array[item]) {
          i = array[item].device_sn;
        }
        if (this.myfunc.whatIsIt(array[item]) === "object") {
          this.isObject(`${key}.${i}`, array[item]);
        } else if (this.myfunc.whatIsIt(array[item]) === "string") {
          this.isString(`${key}.${i}`, array[item]);
        }
        i++;
      });
    }
  }
  async isObject(key, value) {
    const name = key.split(".").pop();
    if (value == null ? void 0 : value.device_sn) {
      value = { ...value, is_admin: this.isAdmin };
      this.CreateOrUpdate(key, name, "device");
    } else {
      this.CreateOrUpdate(key, name, "folder");
    }
    if ((value == null ? void 0 : value.device_pn) && (value == null ? void 0 : value.battery_power) && import_apitypes.DeviceCapacity[value == null ? void 0 : value.device_pn] > 0) {
      if (value == null ? void 0 : value.battery_power) {
        const bat_power = (value == null ? void 0 : value.battery_power) ? value == null ? void 0 : value.battery_power : 0;
        const num_of_batteries = (value == null ? void 0 : value.sub_package_num) ? value == null ? void 0 : value.sub_package_num : 0;
        let cap = 0;
        if (value == null ? void 0 : value.device_pn) {
          cap = import_apitypes.DeviceCapacity[value == null ? void 0 : value.device_pn];
        }
        if (this.config.BatteryBP1600Count > 0 && num_of_batteries > 0) {
          cap = cap + this.config.BatteryBP1600Count * 1600;
        }
        if (this.config.BatteryBP2700Count > 0 && num_of_batteries > 0) {
          cap = cap + this.config.BatteryBP2700Count * 2700;
        }
        if (this.config.BatteryBP2700Count == 0 && this.config.BatteryBP1600Count == 0 && num_of_batteries > 0) {
          cap = cap + num_of_batteries * 1600;
        }
        if (cap > 0 && bat_power > 0) {
          const battery_energy = Math.round(cap * bat_power / 100);
          this.isString(`${key}.battery_energy`, battery_energy, "Wh", "value.energy");
        }
      }
    }
    Object.entries(value).forEach((subentries) => {
      const [objkey, objvalue] = subentries;
      const type = this.myfunc.whatIsIt(objvalue);
      if (type === "array") {
        this.isArray(`${key}.${objkey}`, objvalue);
      } else if (type === "object") {
        this.isObject(`${key}.${objkey}`, objvalue);
      } else {
        this.isString(`${key}.${objkey}`, objvalue);
      }
    });
  }
  async isString(key, value, unit, role = "value") {
    let parmType = "string";
    let parmRole = role;
    let parmUnit = unit ? unit : "";
    const valType = this.myfunc.whatIsIt(value);
    if (valType === "boolean") {
      parmType = "boolean";
    }
    if (valType === "number") {
      parmType = "number";
    }
    if (key.includes("time") && !key.includes("backup_info") && !key.includes("feature_switch")) {
      parmType = "string";
      parmRole = "value.time";
      if (key.includes("create")) {
        value = new Date(value * 1e3).toUTCString();
      } else if (key.includes("update")) {
        value = (/* @__PURE__ */ new Date()).getTime().toString();
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
    if (key.includes("_power") && !key.includes("display") && !key.includes("battery") && !key.includes("feature_switch")) {
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
    const name = key.split(".").pop();
    await this.CreateOrUpdate(key, name, "state", parmType, parmRole, false, parmUnit);
    await this.setState(key, { val: value, ack: true });
  }
  async CreateOrUpdate(path, name = "Error", type, commontype = void 0, role = void 0, writable = void 0, unit = void 0, min = void 0, max = void 0, step = void 0) {
    let newObj = null;
    if (type === "state") {
      newObj = {
        type,
        common: {
          name: this.myfunc.name2id(name),
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
    await this.extendObject(this.myfunc.name2id(path), newObj);
  }
  async setApiCon(status) {
    this.apiConnection = status;
    this.setStateChangedAsync("info.apiconnection", { val: status, ack: true });
  }
  async setPowerplan() {
    var _a, _b;
    try {
      if (!this.myfunc.isLoginValid(this.loginData) || ((_a = this.loginData) == null ? void 0 : _a.email) != this.config.Username) {
        this.loginData = await this.loginAPI();
      }
      if (this.loginData) {
        const powerplan = {
          mode_type: 3,
          //3 = Benutzerdefiniert Modus
          custom_rate_plan: [],
          blend_plan: null,
          use_time: null,
          manual_backup: null,
          reserved_soc: 10,
          ai_ems: { enable: false, status: 3 },
          time_slot: null,
          schedule_mode: null,
          dynamic_price: null,
          /* Wird zum setzen der Powerplan noch nicht benötigt*/
          default_home_load: 200,
          max_load: 800,
          min_load: 0,
          step: 10
        };
        const planMap = /* @__PURE__ */ new Map();
        for (const item of this.config.PowerPlan) {
          const ranges = {
            start_time: item.start_time,
            end_time: item.end_time,
            power: this.myfunc ? this.myfunc.rundeAufZehner(item.power) : item.power
          };
          if (planMap.has(item.week)) {
            (_b = planMap.get(item.week)) == null ? void 0 : _b.ranges.push(ranges);
          } else {
            planMap.set(item.week, {
              index: 0,
              week: item.week.split(",").map(Number),
              ranges: [ranges]
            });
          }
        }
        const custom_rate_plan = Array.from(planMap.values()).map((plan, i) => ({
          ...plan,
          index: i
        }));
        powerplan.custom_rate_plan = custom_rate_plan;
        const siteID = this.config.ControlSiteID.split(".")[2];
        await this.loggedInApi.setSiteDeviceParam("6", siteID, JSON.stringify(powerplan));
      }
    } catch (err) {
      this.log.error(`setParam: ${err}`);
      this.log.debug(`Error Object: ${JSON.stringify(err)}`);
      this.setApiCon(false);
    }
  }
  async setACLoading(status) {
    var _a;
    try {
      if (!this.myfunc.isLoginValid(this.loginData) || ((_a = this.loginData) == null ? void 0 : _a.email) != this.config.Username) {
        this.loginData = await this.loginAPI();
      }
      if (this.loginData) {
        const siteID = this.config.ControlSiteID.split(".")[2];
        const siteDetails = await this.loggedInApi.getSiteDetails(siteID);
        this.sleep(30);
        const acdevice = siteDetails.data.solarbank_list.find(
          (device) => this.myfunc.isACLoading(device.device_pn)
        );
        if (acdevice) {
          const rawResponse = await this.loggedInApi.getSiteDeviceParam("6", siteID);
          const rawData = rawResponse.data.param_data;
          const getpowerplan = JSON.parse(rawData);
          let start_time;
          let end_time;
          if (status) {
            start_time = Math.floor(Date.now() / 1e3);
            end_time = start_time + 43200;
          } else {
            start_time = 0;
            end_time = 0;
          }
          const manuel_backup = {
            ranges: [
              {
                start_time,
                end_time
              }
            ],
            switch: status
          };
          getpowerplan.mode_type = 3;
          getpowerplan.manual_backup = manuel_backup;
          await this.loggedInApi.setSiteDeviceParam("6", siteID, JSON.stringify(getpowerplan));
        } else {
          this.log.warn(`setACLoading: No AC Device found in Site ${siteID}}`);
        }
      }
    } catch (err) {
      this.log.error(`setACLoading: ${err}`);
      this.log.debug(`Error Object: ${JSON.stringify(err)}`);
      this.setApiCon(false);
    }
  }
  async setParam(value) {
    var _a;
    try {
      if (!this.myfunc.isLoginValid(this.loginData) || ((_a = this.loginData) == null ? void 0 : _a.email) != this.config.Username) {
        this.loginData = await this.loginAPI();
      }
      if (this.loginData) {
        this.setApiCon(true);
        const siteID = this.config.ControlSiteID.split(".")[2];
        const { data: powerLimit } = await this.loggedInApi.getPowerLimit(siteID);
        const roundedValue = this.myfunc.rundeAufZehner(value, powerLimit.max_power_limit);
        const jsonstring = '{"mode_type":3,"custom_rate_plan":[{"index":0,"week":[0,1,2,3,4,5,6],"ranges":[{"start_time":"00:00","end_time":"24:00","power":400}]}],"blend_plan":null,"default_home_load":200,"max_load":800,"min_load":0,"step":10}';
        const config = JSON.parse(jsonstring);
        config.mode_type = 3;
        config.custom_rate_plan[0].ranges[0].power = roundedValue;
        await this.loggedInApi.setSiteDeviceParam("6", siteID, JSON.stringify(config));
      }
    } catch (err) {
      this.log.error(`setParam: ${err}`);
      this.log.debug(`Error Object: ${JSON.stringify(err)}`);
      this.setApiCon(false);
    }
  }
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   */
  onUnload(callback) {
    try {
      if (this.refreshTimeout) {
        this.log.debug("refreshTimeout: Unload");
        clearTimeout(this.refreshTimeout);
      }
      if (this.refreshAnalysisTimeout) {
        this.log.debug("refreshAnalysisTimeout: Unload");
        clearTimeout(this.refreshAnalysisTimeout);
      }
      callback();
    } catch (e) {
      this.log.error(`onUnload: ${e}`);
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
    if (id === `${this.config.HomeLoadID}` && this.config.EnableControlDP && this.isAdmin) {
      this.log.info(`HomeLoadID state changed: ${id} - ${JSON.stringify(state)}`);
      const value = state == null ? void 0 : state.val;
      if (typeof value !== "number") {
        this.log.warn(`HomeLoadID state value is not a number: ${value}`);
      } else {
        this.setParam(value);
      }
    }
    if (id === `${this.namespace}.control.ACLoading` && this.isAdmin) {
      this.log.info(`setACLoading state changed: ${id} - ${JSON.stringify(state)}`);
      const value = state == null ? void 0 : state.val;
      if (typeof value !== "boolean") {
        this.log.warn(`setACLoading state value is not a boolean: ${value}`);
      } else {
        this.setACLoading(value);
      }
    }
    if (id === `${this.namespace}.control.SetPowerplan` && this.isAdmin) {
      this.log.info(`setPowerplan state changed: ${id} - ${JSON.stringify(state)}`);
      const value = state == null ? void 0 : state.val;
      if (typeof value !== "boolean") {
        this.log.warn(`setPowerplan state value is not a boolean: ${value}`);
      } else {
        this.setPowerplan();
      }
    }
  }
  // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
  // /**
  //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
  //  * Using this method requires "common.messagebox" property to be set to true in io-package.json
  //  */
  // private onMessage(obj: ioBroker.Message): void {
  //    if (typeof obj === 'object' && obj.message) {
  //        if (obj.command === 'deleteToken') {
  //            //             // e.g. send email or pushover or whatever
  //            this.log.info(`deleteToken - ${JSON.stringify(obj)}`);
  //
  //            //             // Send response in callback if required
  //            if (obj.callback) {
  //                this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
  //            }
  //        }
  //    }
  //}
}
if (require.main !== module) {
  module.exports = (options) => new Ankersolix2(options);
} else {
  (() => new Ankersolix2())();
}
//# sourceMappingURL=main.js.map
