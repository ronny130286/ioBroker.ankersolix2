"use strict";
/*
 * Created with @iobroker/create-adapter v2.6.3
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ankersolix2 = void 0;
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
//import * as utils from '@iobroker/adapter-core';
const adapter_core_1 = require("@iobroker/adapter-core");
const fs_1 = __importStar(require("fs"));
const api_1 = require("./lib/api");
const apitypes_1 = require("./lib/apitypes");
const func_1 = require("./lib/func");
const schedule_1 = require("./lib/schedule");
const translate_1 = require("./lib/translate");
// Load your modules here, e.g.:
class Ankersolix2 extends adapter_core_1.Adapter {
    storeData = '';
    refreshTimeout;
    refreshAnalysisTimeout;
    loginData;
    api;
    apiConnection;
    sleep;
    isAdmin = false;
    loggedInApi;
    myfunc;
    mySchedule;
    myTranslate;
    constructor(options = {}) {
        super({
            ...options,
            name: 'ankersolix2',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
        this.storeData = `${(0, adapter_core_1.getAbsoluteInstanceDataDir)(this)}/session.json`;
        this.loginData = null;
        this.refreshTimeout = null;
        this.refreshAnalysisTimeout = null;
        this.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        this.api = null;
        this.apiConnection = false;
        this.myTranslate = new translate_1.MyTranslate(this);
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here
        this.myfunc = new func_1.MyFunc(this);
        this.mySchedule = new schedule_1.MySchedule(this);
        try {
            await this.myTranslate.init();
        }
        catch (err) {
            this.log.error(`Translation init error: ${err.message}`);
        }
        if (!this.validateAdapterConfig(this.config)) {
            //this.terminate('Invalid configuration, please check instance settings', 400);
            return;
        }
        if (this.config.EnableTimePlan && this.config.TimePlan.length > 0) {
            const myTimePlan = this.config.TimePlan;
            this.mySchedule.scheduleJobsTimeplan(myTimePlan);
        }
        try {
            // create directory to store fetch data
            if (!fs_1.default.existsSync((0, adapter_core_1.getAbsoluteInstanceDataDir)(this))) {
                fs_1.default.mkdirSync((0, adapter_core_1.getAbsoluteInstanceDataDir)(this));
                this.log.debug(`Folder created: ${this.storeData}`);
            }
        }
        catch (err) {
            this.log.error(`Could not create storage directory (${(0, adapter_core_1.getAbsoluteInstanceDataDir)(this)}): ${err}`);
            return;
        }
        this.loginData = await this.loginAPI();
        if (typeof this.config.HomeLoadID === 'string' && this.config.HomeLoadID.trim() !== '') {
            if (this.config.EnableControlDP) {
                this.setHomeLoadID(true);
            }
            if (this.config.EnableACLoading) {
                this.subscribeForeignStates(`${this.namespace}.control.ACLoading`);
            }
            if (this.config.EnableCustomPowerPlan && this.config.PowerPlan?.length > 0) {
                this.subscribeForeignStates(`${this.namespace}.control.SetPowerplan`);
                if (this.config.PowerPlanAtReload) {
                    this.setPowerPlan();
                }
            }
        }
        this.refreshDate();
        if (this.config.AnalysisGrid || this.config.AnalysisHomeUsage || this.config.AnalysisSolarproduction) {
            this.refreshAnalysis();
        }
    }
    /**
     * Steuert das abonnieren und deabonnieren des HomeLoadID States
     *
     * @param status
     * @returns
     */
    async setHomeLoadID(status, timeplan) {
        if (status) {
            this.subscribeForeignStates(`${this.config.HomeLoadID}`);
            if (timeplan) {
                const state = await this.getForeignStateAsync(`${this.config.HomeLoadID}`);
                const value = state ? state.val : 0;
                this.setForeignState(`${this.config.HomeLoadID}`, { val: value, ack: true });
            }
            return;
        }
        this.unsubscribeForeignStates(`${this.config.HomeLoadID}`);
    }
    validateAdapterConfig(config) {
        const errors = [];
        if (!config.Username || !config.Password) {
            errors.push('Username and/or Password missing');
        }
        const poll = config?.POLL_INTERVAL;
        if (typeof poll !== 'number' || poll < 10 || poll > 3600) {
            errors.push('Poll interval must be between 10 and 3600 seconds');
        }
        if (!config.API_Server) {
            errors.push('API Server missing');
        }
        if (!config.COUNTRY && !config.COUNTRY2) {
            errors.push('Country missing');
        }
        if (errors.length > 0) {
            errors.forEach(err => this.log.error(`${err} - please check instance configuration of ${this.namespace}`));
            return false;
        }
        return true;
    }
    async loginAPI() {
        const country = this.config.API_Server === 'https://ankerpower-api-eu.anker.com'
            ? this.config.COUNTRY
            : this.config.COUNTRY2;
        this.api = new api_1.SolixApi({
            username: this.config.Username,
            password: this.config.Password,
            server: this.config.API_Server,
            country: country,
        }, this);
        let login = await this.restoreLoginData();
        if (login) {
            let newneed = false;
            //check if login token not expired
            if (!this.myfunc.isLoginValid(login)) {
                this.log.debug('loginAPI: token expired');
                newneed = true;
            }
            //check if username in stored file the same in config
            if (login?.email !== this.config.Username) {
                this.log.debug('loginAPI: username are different');
                newneed = true;
            }
            if (newneed) {
                login = null;
            }
        }
        if (login == null) {
            try {
                const loginResponse = await this.api.login();
                login = loginResponse.data ?? null;
                this.log.debug(`LoginResponseCode: ${loginResponse.code} => ${loginResponse.msg}`);
                if (login && loginResponse.code == 0) {
                    this.log.debug(`Write data to file`);
                    await fs_1.promises.writeFile(this.storeData, JSON.stringify(login), 'utf-8');
                }
            }
            catch (error) {
                this.log.error(`loginAPI: ${error.message}`);
                const status = error.status;
                if (status == 401) {
                    if (fs_1.default.existsSync(this.storeData)) {
                        fs_1.default.unlinkSync(this.storeData);
                    }
                    this.terminate('Credentials are wrong, please check and restart', status);
                }
                return null;
            }
        }
        else {
            this.log.debug('Using auth data from savefile');
        }
        this.loggedInApi = await this.api.withLogin(login);
        //check if User is Admin
        const bindedDevice = await this.loggedInApi.bind_device();
        if (bindedDevice.data.data.length > 0) {
            this.isAdmin = true;
            //this.log.info(`User ist Admin:`);
        }
        else {
            this.isAdmin = false;
            //this.log.info(`User is not Admin, only read access to own devices.`);
        }
        return login;
    }
    async restoreLoginData() {
        try {
            this.log.debug('Try to restore data from File');
            const data = await fs_1.promises.readFile(this.storeData, 'utf8');
            return JSON.parse(data);
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                this.log.debug(`RestoreLoginData: ${err.message}`);
                return null;
            }
            this.log.debug(`RestoreLoginData: ${err.message}`);
            return null;
        }
    }
    async refreshDate() {
        let refresh = this.config.POLL_INTERVAL;
        try {
            if (!this.myfunc.isLoginValid(this.loginData) || this.loginData?.email != this.config.Username) {
                this.loginData = await this.loginAPI();
            }
            if (this.loginData) {
                this.setApiCon(true);
                await this.fetchAndPublish();
            }
        }
        catch (err) {
            this.log.error(`Failed fetching or publishing printer data, Error: ${err}`);
            this.log.debug(`Error Object: ${JSON.stringify(err)}`);
            this.setApiCon(false);
            refresh = this.config.POLL_INTERVAL * 5;
            if (err.status == 401) {
                if (fs_1.default.existsSync(this.storeData)) {
                    fs_1.default.unlinkSync(this.storeData);
                }
                this.terminate('Credentials are wrong, please check and restart', err);
            }
        }
        finally {
            if (this.refreshTimeout) {
                this.log.debug(`refreshTimeout clear: ${this.refreshTimeout.id}`);
                this.clearTimeout(this.refreshTimeout);
            }
            this.refreshTimeout = this.setTimeout(() => {
                this.refreshTimeout = null;
                this.refreshDate();
            }, refresh * 1000);
            this.log.debug(`Sleeping for ${refresh * 1000}ms... TimerId ${this.refreshTimeout}`);
        }
    }
    async refreshAnalysis() {
        try {
            if (!this.myfunc.isLoginValid(this.loginData) || this.loginData?.email != this.config.Username) {
                this.loginData = await this.loginAPI();
            }
            if (this.loginData) {
                this.setApiCon(true);
                await this.fetchAndPublishAnalysis();
            }
        }
        catch (err) {
            this.log.error(`Failed fetching or publishing analysisdata: ${err}`);
            this.log.debug(`Error Object: ${JSON.stringify(err)}`);
            this.setApiCon(false);
        }
        finally {
            if (this.refreshAnalysisTimeout) {
                this.log.debug(`refreshAnalysisTimeout clear: ${this.refreshAnalysisTimeout.id}`);
                this.clearTimeout(this.refreshAnalysisTimeout);
            }
            this.refreshAnalysisTimeout = this.setTimeout(() => {
                this.refreshAnalysisTimeout = null;
                this.refreshAnalysis();
            }, 600 * 1000);
            this.log.debug(`Analysis Sleeping for ${600 * 1000}ms... TimerId ${this.refreshAnalysisTimeout}`);
        }
    }
    async fetchAndPublish() {
        //const loggedInApi = await this.api.withLogin(this.loginData);
        const siteHomepage = await this.loggedInApi.siteHomepage();
        let sites;
        if (siteHomepage.data.site_list.length === 0) {
            // Fallback for Shared Accounts
            sites = (await this.loggedInApi.getSiteList()).data.site_list;
        }
        else {
            sites = siteHomepage.data.site_list;
        }
        /*
        //TODO IN AdminUI einbauen
        const ruleConfig = {
            always: [],
            conditional: {
                grid_info: { enabled: true, value: ['grid_list'] },
                pps_info: { enabled: true, value: ['pps_list'] },
                solarbank_pps_info: { enabled: true, value: ['pps_list'] },
                solarbank_info: { enabled: true, value: ['solarbank_list'] },
            },
        };
        */
        for (const site of sites) {
            const scenInfo = await this.loggedInApi.scenInfo(site.site_id);
            const message = JSON.stringify(scenInfo.data);
            const jsonparse = JSON.parse(message);
            this.CreateOrUpdate(site.site_id, site.site_name, 'folder');
            this.CreateOrUpdate(`${site.site_id}.EXTRA`, 'EXTRA', 'folder');
            /*
            //Regeln zum entfernen von nicht benötigten Daten
            const rules = {
                always: ruleConfig.always,
                conditional: {} as Record<string, string[]>,
            };

            for (const [key, config] of Object.entries(ruleConfig.conditional)) {
                if (config.enabled) {
                    rules.conditional[key] = config.value;
                }
            }
            const testJson = this.myfunc.cleanseWithRules(jsonparse, rules);
            await this.CreateOrUpdate(
                `${site.site_id}.EXTRA.RAW_JSON_Cleaned`,
                'RAW_JSON_Cleaned',
                'state',
                'string',
                'value',
                false,
                'undefined',
            );
            this.setState(`${site.site_id}.EXTRA.RAW_JSON_Cleaned`, { val: JSON.stringify(testJson), ack: true });
            */
            await this.CreateOrUpdate(`${site.site_id}.EXTRA.RAW_JSON`, 'RAW_JSON', 'state', 'string', 'value', false, 'undefined');
            this.setState(`${site.site_id}.EXTRA.RAW_JSON`, { val: message, ack: true });
            this.parseObjects(`${site.site_id}`, jsonparse);
        }
        this.log.debug('Published Data.');
        this.sleep(30); //Wartezeit zwischen den Anfragen
    }
    async fetchAndPublishAnalysis() {
        //const loggedInApi = await this.api.withLogin(this.loginData);
        const siteHomepage = await this.loggedInApi.siteHomepage();
        let sites;
        let scenInfo;
        if (siteHomepage.data.site_list.length === 0) {
            // Fallback for Shared Accounts
            sites = (await this.loggedInApi.getSiteList()).data.site_list;
        }
        else {
            sites = siteHomepage.data.site_list;
        }
        for (const site of sites) {
            const ranges = ['day', 'week'];
            scenInfo = !scenInfo ? await this.loggedInApi.scenInfo(site.site_id) : scenInfo;
            const scenInfoData = JSON.parse(JSON.stringify(scenInfo.data));
            //const scenInfoData = JSON.parse(await pfs.readFile(`${utils.getAbsoluteInstanceDataDir(this)}/debug.json`, 'utf8'),);
            this.CreateOrUpdate(`${site.site_id}.energyanalysis`, 'energyanalysis', 'folder');
            for (const range of ranges) {
                const date = new Date();
                const start = range === 'week'
                    ? new Date(date.setDate(date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1)))
                    : new Date();
                const ende = range === 'week' ? new Date(date.setDate(start.getDate() + 6)) : new Date();
                //Solarpoduction Info
                if (this.config.AnalysisSolarproduction &&
                    ((range === 'day' && this.config.AnalysisSolarproductionDay) ||
                        (range === 'week' && this.config.AnalysisSolarproductionWeek))) {
                    try {
                        const energyInfo = await this.loggedInApi.energyAnalysis(site.site_id, '', 'week', start, ende, 'solar_production');
                        this.CreateOrUpdate(`${site.site_id}.energyanalysis.solar_production`, `solar_production`, 'folder');
                        this.CreateOrUpdate(`${site.site_id}.energyanalysis.solar_production.${range}`, `${range}`, 'folder');
                        const energy_message = JSON.stringify(energyInfo.data);
                        this.parseObjects(`${site.site_id}.energyanalysis.solar_production.${range}`, JSON.parse(energy_message));
                        await this.sleep(5000);
                    }
                    catch (err) {
                        this.log.debug(`Published Analysis SolarProd ${range} Error: ${err.code}`);
                    }
                }
                //GRID Infos
                if (this.config.AnalysisGrid &&
                    ((range === 'day' && this.config.AnalysisGridDay) ||
                        (range === 'week' && this.config.AnalysisGridWeek))) {
                    try {
                        const gridInfo = await this.loggedInApi.energyAnalysis(site.site_id, '', 'week', start, ende, 'grid');
                        this.CreateOrUpdate(`${site.site_id}.energyanalysis.grid`, `grid`, 'folder');
                        this.CreateOrUpdate(`${site.site_id}.energyanalysis.grid.${range}`, `${range}`, 'folder');
                        this.parseObjects(`${site.site_id}.energyanalysis.grid.${range}`, JSON.parse(JSON.stringify(gridInfo.data)));
                        await this.sleep(5000);
                    }
                    catch (err) {
                        this.log.debug(`Published Analysis Grid ${range} Error: ${err.code}`);
                    }
                }
                //HOME_USAGE Infos
                if (this.config.AnalysisHomeUsage &&
                    ((range === 'day' && this.config.AnalysisHomeUsageDay) ||
                        (range === 'week' && this.config.AnalysisHomeUsageWeek))) {
                    if (scenInfoData.grid_info != null) {
                        try {
                            for (const i in scenInfoData.grid_info.grid_list) {
                                if ('device_sn' in scenInfoData.grid_info.grid_list[i]) {
                                    const device_sn = scenInfoData.grid_info.grid_list[i].device_sn;
                                    this.CreateOrUpdate(`${site.site_id}.energyanalysis.home_usage`, `home_usage`, 'folder');
                                    this.CreateOrUpdate(`${site.site_id}.energyanalysis.home_usage.${device_sn}`, `${device_sn}`, 'folder');
                                    this.CreateOrUpdate(`${site.site_id}.energyanalysis.home_usage.${device_sn}.${range}`, `${range}`, 'folder');
                                    const homeusageInfo = await this.loggedInApi.energyAnalysis(site.site_id, device_sn, 'week', start, ende, 'home_usage');
                                    this.parseObjects(`${site.site_id}.energyanalysis.home_usage.${device_sn}.${range}`, JSON.parse(JSON.stringify(homeusageInfo.data)));
                                }
                            }
                            await this.sleep(5000);
                        }
                        catch (err) {
                            this.log.debug(`Published Analysis HomeUsage ${range} Error: ${err.code}`);
                        }
                    }
                    else {
                        this.log.debug(`Published Analysis HomeUsage ${range} Error: No smart meter found, you can disable it in config of instance`);
                    }
                }
                this.sleep(30); //Wartezeit zwischen den Anfragen
            }
        }
        this.log.debug('Published Analysis Data.');
        this.sleep(30); //Wartezeit zwischen den Anfragen
    }
    parseObjects(key, jOb) {
        //this.log.debug(`parseObjects : ${JSON.stringify(jOb)}`);
        Object.entries(JSON.parse(JSON.stringify(jOb))).forEach(entries => {
            const [id, value] = entries;
            const type = this.myfunc.whatIsIt(value);
            if (type === 'array') {
                this.isArray(`${key}.${id}`, value);
            }
            else if (type === 'object') {
                this.isObject(`${key}.${id}`, value);
            }
            else {
                this.isString(`${key}.${id}`, value);
            }
        });
    }
    isArray(key, value) {
        const name = key.split('.').pop();
        this.CreateOrUpdate(`${key}`, name, 'folder');
        const array = JSON.parse(JSON.stringify(value));
        //for statistics
        if (key.includes('statistics')) {
            Object.entries(value).forEach(subentries => {
                const [objkey, objvalue] = subentries;
                const json = JSON.parse(JSON.stringify(objvalue));
                let role = 'value';
                let idname = objkey;
                if (json.type === '1') {
                    role = 'value.energy';
                    idname = 'total_energy';
                }
                else if (json.type === '2') {
                    role = 'value';
                    idname = 'total_co2_savings';
                }
                else if (json.type === '3') {
                    role = 'value';
                    idname = 'total_money_savings';
                }
                //this.log.debug(`array stat:${key}.${idname}, ${json.total}, ${json.unit}, ${role}`);
                this.isString(`${key}.${idname}`, json.total, json.unit, role);
            });
        }
        else {
            let i = '0';
            array.forEach((elem, item) => {
                if ('device_sn' in array[item]) {
                    i = array[item].device_sn;
                }
                if (this.myfunc.whatIsIt(array[item]) === 'object') {
                    this.isObject(`${key}.${i}`, array[item]);
                }
                else if (this.myfunc.whatIsIt(array[item]) === 'string') {
                    this.isString(`${key}.${i}`, array[item]);
                }
                i++;
            });
        }
    }
    async isObject(key, value) {
        const name = key.split('.').pop();
        if (value?.device_sn) {
            //if User is Admin, set is_admin to true to all devices
            value = { ...value, is_admin: this.isAdmin };
            this.CreateOrUpdate(key, name, 'device');
        }
        else {
            this.CreateOrUpdate(key, name, 'folder');
        }
        //this.log.debug(`isObject: ${name}`);
        //calculate battery capacity
        if (value?.device_pn && value?.battery_power && apitypes_1.DeviceCapacity[value?.device_pn] > 0) {
            if (value?.battery_power) {
                //this.log.debug(`isObject: ${key}, ${value}`);
                const bat_power = value?.battery_power ? value?.battery_power : 0;
                const num_of_batteries = value?.sub_package_num ? value?.sub_package_num : 0;
                let cap = 0;
                if (value?.device_pn) {
                    cap = apitypes_1.DeviceCapacity[value?.device_pn];
                    //this.log.debug(`device: ${value?.device_pn} ,Capacity: ${cap}`);
                }
                //this.log.debug(`isObject: ${key}, BatteryBP1600Count: ${this.config.BatteryBP1600Count}, BatteryBP2700Count: ${this.config.BatteryBP2700Count}`,);
                if (this.config.BatteryBP1600Count > 0 && num_of_batteries > 0) {
                    cap = cap + this.config.BatteryBP1600Count * 1600;
                    //this.log.debug(`BatteryBP1600Count: ${key},Capacity: ${cap}`);
                }
                if (this.config.BatteryBP2700Count > 0 && num_of_batteries > 0) {
                    cap = cap + this.config.BatteryBP2700Count * 2700;
                    //this.log.debug(`BatteryBP2700Count: ${key},Capacity: ${cap}`);
                }
                if (this.config.BatteryBP2700Count == 0 &&
                    this.config.BatteryBP1600Count == 0 &&
                    num_of_batteries > 0) {
                    cap = cap + num_of_batteries * 1600;
                }
                //this.log.debug(`isObject: ${key}, Battery Power: ${bat_power}, Capacity: ${cap}, Number of Batteries: ${num_of_batteries}`,);
                if (cap > 0 && bat_power > 0) {
                    const battery_energy = Math.round((cap * bat_power) / 100);
                    this.isString(`${key}.battery_energy`, battery_energy, 'Wh', 'value.energy');
                }
            }
        }
        Object.entries(value).forEach(subentries => {
            const [objkey, objvalue] = subentries;
            const type = this.myfunc.whatIsIt(objvalue);
            if (type === 'array') {
                this.isArray(`${key}.${objkey}`, objvalue);
            }
            else if (type === 'object') {
                this.isObject(`${key}.${objkey}`, objvalue);
            }
            else {
                this.isString(`${key}.${objkey}`, objvalue);
            }
        });
    }
    async isString(key, value, unit, role = 'value') {
        //this.log.debug(`isString: ${key}`);
        let parmType = 'string';
        let parmRole = role;
        let parmUnit = unit ? unit : '';
        const valType = this.myfunc.whatIsIt(value);
        if (valType === 'boolean') {
            parmType = 'boolean';
        }
        if (valType === 'number') {
            parmType = 'number';
        }
        if (key.includes('time') && !key.includes('backup_info') && !key.includes('feature_switch')) {
            parmType = 'string';
            parmRole = 'value.time';
            if (key.includes('create')) {
                value = new Date(value * 1000).toUTCString();
            }
            else if (key.includes('update')) {
                //when Update_time not set in JSON, set it to actual time
                value = new Date().getTime().toString();
            }
        }
        if (key.includes('unit')) {
            switch (value) {
                case 'kWh':
                case 'W':
                    parmRole = 'value.energy';
                    break;
            }
        }
        if (key.includes('_power') &&
            !key.includes('display') &&
            !key.includes('battery') &&
            !key.includes('feature_switch')) {
            parmType = 'number';
            value = +value;
            parmUnit = 'W';
        }
        if (key.includes('battery_power')) {
            //Battery_power Level in %
            parmRole = 'value.fill';
            parmUnit = '%';
            parmType = 'number';
            if (key.includes('total_battery_power')) {
                value = +value * 100;
            }
            else {
                value = +value;
            }
        }
        const name = key.split('.').pop();
        await this.CreateOrUpdate(key, name, 'state', parmType, parmRole, false, parmUnit);
        await this.setState(key, { val: value, ack: true });
    }
    async CreateOrUpdate(path, name = 'Error', type, commontype = undefined, role = undefined, writable = undefined, unit = undefined, min = undefined, max = undefined, step = undefined) {
        let newObj = null;
        if (type === 'state') {
            newObj = {
                type: type,
                common: {
                    name: this.myfunc.name2id(name),
                    type: commontype,
                    role: role,
                    read: true,
                    write: writable,
                    unit: unit,
                    min: min,
                    max: max,
                    step: step,
                },
                native: {},
            };
        }
        else {
            newObj = {
                type: type,
                common: { name: name },
                native: {},
            };
        }
        await this.extendObject(this.myfunc.name2id(path), newObj);
    }
    async setApiCon(status) {
        this.apiConnection = status;
        this.setStateChangedAsync('info.apiconnection', { val: status, ack: true });
    }
    async setPowerPlan(options) {
        try {
            if (!this.myfunc.isLoginValid(this.loginData) || this.loginData?.email != this.config.Username) {
                this.loginData = await this.loginAPI();
            }
            if (this.loginData) {
                const { adminui, modus } = options ? options : { adminui: null, modus: undefined };
                const siteID = this.config.ControlSiteID.split('.')[2];
                //ggf. prüfen ob extra Funktion
                const rawResponse = await this.loggedInApi.getSiteDeviceParam('6', siteID);
                const rawData = rawResponse.data.param_data;
                const powerplan = JSON.parse(rawData);
                const planMap = new Map();
                const plan = adminui?.message?.table ? adminui.message.table : this.config.PowerPlan;
                const validate = this.myfunc.hasTimeOverlap(plan);
                if (!validate) {
                    for (const item of plan) {
                        const ranges = {
                            start_time: item.start_time,
                            end_time: item.end_time,
                            power: this.myfunc ? this.myfunc.rundeAufZehner(item.power) : item.power,
                        };
                        if (planMap.has(item.week)) {
                            planMap.get(item.week)?.ranges.push(ranges);
                        }
                        else {
                            planMap.set(item.week, {
                                index: 0,
                                week: item.week.split(',').map(Number),
                                ranges: [ranges],
                            });
                        }
                    }
                    const custom_rate_plan = Array.from(planMap.values()).map((plan, i) => ({
                        ...plan,
                        index: i,
                    }));
                    powerplan.mode_type = modus !== undefined ? modus : powerplan.mode_type; //1=Automatisch, 2=Blend, 3=Benutzerdefiniert, 4=Backup, 5=ECO, 6=Smart
                    powerplan.custom_rate_plan = custom_rate_plan;
                    await this.loggedInApi.setSiteDeviceParam('6', siteID, JSON.stringify(powerplan));
                    if (adminui) {
                        //Wenn von AdminUI dann Callback
                        if (adminui.callback) {
                            this.sendTo(adminui.from, adminui.command, { result: 'OK' }, adminui.callback);
                        }
                    }
                }
                else {
                    if (adminui) {
                        //Wenn von AdminUI dann Callback mit Fehlermeldung
                        if (adminui.callback) {
                            this.sendTo(adminui.from, adminui.command, { error: `${validate}` }, adminui.callback);
                        }
                    }
                    else {
                        this.log.warn(`this.setPowerPlan: ${validate} `);
                    }
                }
            }
        }
        catch (err) {
            this.log.error(`setPowerPlan: ${err}`);
            this.log.debug(`Error Object: ${JSON.stringify(err)}`);
            this.setApiCon(false);
        }
    }
    async setACLoading(status) {
        try {
            if (!this.myfunc.isLoginValid(this.loginData) || this.loginData?.email != this.config.Username) {
                this.loginData = await this.loginAPI();
            }
            if (this.loginData) {
                const siteID = this.config.ControlSiteID.split('.')[2];
                //prüfen ob ein AC Gerät vorhanden ist
                const siteDetails = await this.loggedInApi.getSiteDetails(siteID);
                this.sleep(30); //Wartezeit zwischen Anfragen
                const acdevice = siteDetails.data.solarbank_list.find((device) => this.myfunc.isACLoading(device.device_pn));
                if (acdevice) {
                    const rawResponse = await this.loggedInApi.getSiteDeviceParam('6', siteID);
                    const rawData = rawResponse.data.param_data;
                    const getpowerplan = JSON.parse(rawData);
                    let start_time;
                    let end_time;
                    if (status) {
                        start_time = Math.floor(Date.now() / 1000); // aktuelle Zeit in Sekunden
                        end_time = start_time + 43200; //; // +12h ebenfalls in Sekunden
                    }
                    else {
                        start_time = 0;
                        end_time = 0;
                    }
                    const manuel_backup = {
                        ranges: [
                            {
                                start_time: start_time,
                                end_time: end_time,
                            },
                        ],
                        switch: status,
                    };
                    getpowerplan.manual_backup = manuel_backup;
                    await this.loggedInApi.setSiteDeviceParam('6', siteID, JSON.stringify(getpowerplan));
                }
                else {
                    this.log.warn(`setACLoading: No AC Device found in Site ${siteID}}`);
                }
            }
        }
        catch (err) {
            this.log.error(`setACLoading: ${err}`);
            this.log.debug(`Error Object: ${JSON.stringify(err)}`);
            this.setApiCon(false);
        }
    }
    async setControlByAdapter(value) {
        try {
            if (!this.myfunc.isLoginValid(this.loginData) || this.loginData?.email != this.config.Username) {
                this.loginData = await this.loginAPI();
            }
            if (this.loginData) {
                this.setApiCon(true);
                const siteID = this.config.ControlSiteID.split('.')[2];
                const { data: powerLimit } = await this.loggedInApi.getPowerLimit(siteID);
                const roundedValue = this.myfunc.rundeAufZehner(value, powerLimit.max_power_limit);
                /**/
                const jsonstring = '{"mode_type":3,"custom_rate_plan":[{"index":0,"week":[0,1,2,3,4,5,6],"ranges":[{"start_time":"00:00","end_time":"24:00","power":400}]}],"blend_plan":null,"default_home_load":200,"max_load":800,"min_load":0,"step":10}';
                const config = JSON.parse(jsonstring);
                config.mode_type = 3; //3 = Benutzerdefiniert Modus
                config.custom_rate_plan[0].ranges[0].power = roundedValue; //
                await this.loggedInApi.setSiteDeviceParam('6', siteID, JSON.stringify(config));
            }
        }
        catch (err) {
            this.log.error(`setControlByAdapter: ${err}`);
            this.log.debug(`Error Object: ${JSON.stringify(err)}`);
            this.setApiCon(false);
        }
    }
    async getSiteParamForAdmin(obj) {
        try {
            if (!this.myfunc.isLoginValid(this.loginData) || this.loginData?.email != this.config.Username) {
                this.loginData = await this.loginAPI();
            }
            if (this.loginData) {
                this.setApiCon(true);
                const siteID = this.config.ControlSiteID.split('.')[2];
                const rawResponse = await this.loggedInApi.getSiteDeviceParam('6', siteID);
                const rawData = await rawResponse.data.param_data;
                const getpowerplan = JSON.parse(rawData);
                const powerList = [];
                let globalIndex = 0;
                for (const plan of Object.values(getpowerplan.custom_rate_plan)) {
                    for (const range of plan.ranges) {
                        powerList.push({
                            index: globalIndex++,
                            week: JSON.stringify(plan.week).replace(/^\[|\]$/g, ''),
                            start_time: range.start_time,
                            end_time: range.end_time,
                            power: range.power,
                        });
                    }
                }
                if (typeof obj === 'object') {
                    this.sendTo(obj.from, obj.command, { native: { PowerPlan: powerList } }, obj.callback);
                }
            }
        }
        catch (err) {
            this.sendTo(obj.from, obj.command, {}, obj.callback);
            this.log.error(`getSiteParamForAdmin: ${err}`);
            this.log.debug(`Error Object: ${JSON.stringify(err)}`);
            this.setApiCon(false);
        }
    }
    async getModeListForAdmin(obj) {
        try {
            if (!this.myfunc.isLoginValid(this.loginData) || this.loginData?.email != this.config.Username) {
                this.loginData = await this.loginAPI();
            }
            if (this.loginData) {
                this.setApiCon(true);
                const siteID = this.config.ControlSiteID.split('.')[2];
                const rawData = await this.getStateAsync(`${siteID}.EXTRA.RAW_JSON`);
                const siteDetails = JSON.parse(typeof rawData?.val === 'string' ? rawData.val : '{}');
                //prüfen ob ein AC Gerät vorhanden ist
                const acdevice = siteDetails.solarbank_info.solarbank_list.find((device) => this.myfunc.isACLoading(device.device_pn));
                const list = [];
                if (acdevice) {
                    list.push({
                        label: this.myTranslate.getTranslation('Charging with mains power'),
                        value: apitypes_1.SolarbankModeType.backup,
                    });
                }
                if (siteDetails.grid_info.grid_list.length > 0) {
                    list.push({
                        label: this.myTranslate.getTranslation('Own consumption'),
                        value: apitypes_1.SolarbankModeType.smartmeter,
                    });
                }
                list.push({
                    label: this.myTranslate.getTranslation('Control by adapter'),
                    value: apitypes_1.SolarbankModeType.controlbyadapter,
                });
                list.push({ label: this.myTranslate.getTranslation('Custom mode'), value: apitypes_1.SolarbankModeType.manual });
                if (obj.callback) {
                    this.sendTo(obj.from, obj.command, list, obj.callback);
                }
            }
        }
        catch (err) {
            this.sendTo(obj.from, obj.command, {}, obj.callback);
            this.log.error(`getModeListForAdmin: ${err}`);
            this.log.debug(`Error Object: ${JSON.stringify(err)}`);
            this.setApiCon(false);
        }
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);
            if (this.refreshTimeout) {
                this.log.debug('refreshTimeout: Unload');
                clearTimeout(this.refreshTimeout);
            }
            if (this.refreshAnalysisTimeout) {
                this.log.debug('refreshAnalysisTimeout: Unload');
                clearTimeout(this.refreshAnalysisTimeout);
            }
            if (this.mySchedule?.scheduleJobs) {
                this.mySchedule.stopAllJobs();
            }
            callback();
        }
        catch (e) {
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
            //this.log.info(`HomeLoadID state changed: ${id} - ${JSON.stringify(state)}`);
            const value = state?.val;
            if (typeof value !== 'number') {
                this.log.warn(`HomeLoadID state value is not a number: ${value}`);
            }
            else {
                //this.log.info(`HomeLoadID state value: ${this.rundeAufZehner(wert)}`);
                this.setControlByAdapter(value);
            }
        }
        if (id === `${this.namespace}.control.ACLoading` && this.isAdmin) {
            //this.log.info(`setACLoading state changed: ${id} - ${JSON.stringify(state)}`);
            const value = state?.val;
            if (typeof value !== 'boolean') {
                this.log.warn(`setACLoading state value is not a boolean: ${value}`);
            }
            else {
                this.setACLoading(value);
            }
        }
        if (id === `${this.namespace}.control.SetPowerplan` && this.isAdmin) {
            //this.log.info(`setPowerplan state changed: ${id} - ${JSON.stringify(state)}`);
            const value = state?.val;
            if (typeof value !== 'boolean') {
                this.log.warn(`setPowerplan state value is not a boolean: ${value}`);
            }
            else {
                this.setPowerPlan({ modus: apitypes_1.SolarbankModeType.manual });
            }
        }
        /*
        if (state) {
            //        // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            //        // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
            */
    }
    // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.messagebox" property to be set to true in io-package.json
    //  */
    onMessage(obj) {
        if (typeof obj === 'object') {
            if (obj.command === 'getModilist') {
                this.getModeListForAdmin(obj);
            }
            if (obj.message) {
                if (obj.command === 'getDataFromCloud') {
                    // Send response in callback if required
                    this.getSiteParamForAdmin(obj);
                }
                if (obj.command === 'sendDataToCloud') {
                    // Send response in callback if required
                    if (obj.message?.table) {
                        this.setPowerPlan({ adminui: obj });
                    }
                }
                if (obj.command === 'showTimePlan') {
                    //this.setPowerPlan({ modus: SolarbankModeType.smartmeter });
                    this.setACLoading(true);
                }
            }
        }
    }
}
exports.Ankersolix2 = Ankersolix2;
if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options) => new Ankersolix2(options);
}
else {
    // otherwise start the instance directly
    (() => new Ankersolix2())();
}
//# sourceMappingURL=main.js.map