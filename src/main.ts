/*
 * Created with @iobroker/create-adapter v2.6.3
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';
import fs, { promises as pfs } from 'fs';
import { SolixApi, type LoginResultResponse } from './api';
import { DeviceCapacity, type EnergyConfig } from './apitypes';

// Load your modules here, e.g.:

class Ankersolix2 extends utils.Adapter {
    private storeData: string = '';
    private refreshTimeout: any;
    private refreshAnalysisTimeout: any;
    private loginData: LoginResultResponse | null;
    private api: any;
    private apiConnection: boolean;
    private sleep: any;
    private isAdmin: boolean = false;
    private loggedInApi: any;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'ankersolix2',
        });

        this.storeData = `${utils.getAbsoluteInstanceDataDir(this)}/session.json`;
        this.loginData = null;
        this.refreshTimeout = null;
        this.refreshAnalysisTimeout = null;
        this.sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        this.api = null;
        this.apiConnection = false;
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        //this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        // Initialize your adapter here
        if (this.config.HomeLoadID.trim() !== '' && this.config.EnableControl) {
            //this.log.debug(`HomeLoadID: ${this.config.HomeLoadID}`);

            this.subscribeForeignStates(`${this.config.HomeLoadID}`);
        }

        if (!this.config.Username || !this.config.Password) {
            this.log.error(
                `User name and/or user password empty - please check instance configuration of ${this.namespace}`,
            );
            return;
        }

        if (!this.config.POLL_INTERVAL && (this.config.POLL_INTERVAL < 10 || this.config.POLL_INTERVAL > 3600)) {
            this.log.error(
                `The poll intervall must be between 10 and 3600 secounds - please check instance configuration of ${this.namespace}`,
            );
            return;
        }

        try {
            // create directory to store fetch data
            if (!fs.existsSync(utils.getAbsoluteInstanceDataDir(this))) {
                fs.mkdirSync(utils.getAbsoluteInstanceDataDir(this));
                this.log.debug(`Folder created: ${this.storeData}`);
            }
        } catch (err: any) {
            this.log.error(`Could not create storage directory (${utils.getAbsoluteInstanceDataDir(this)}): ${err}`);
            return;
        }

        this.loginData = await this.loginAPI();

        this.refreshDate();

        if (this.config.AnalysisGrid || this.config.AnalysisHomeUsage || this.config.AnalysisSolarproduction) {
            this.refreshAnalysis();
        }
    }

    async loginAPI(): Promise<LoginResultResponse | null> {
        const country =
            this.config.API_Server === 'https://ankerpower-api-eu.anker.com'
                ? this.config.COUNTRY
                : this.config.COUNTRY2;

        this.api = new SolixApi({
            username: this.config.Username,
            password: this.config.Password,
            server: this.config.API_Server,
            country: country,
            log: this.log,
        });
        let login = await this.restoreLoginData();
        if (login) {
            let newneed = false;
            //check if login token not expired
            if (!this.isLoginValid(login)) {
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
                    await pfs.writeFile(this.storeData, JSON.stringify(login), 'utf-8');
                }
            } catch (error: any) {
                this.log.error(`loginAPI: ${error.message}`);
                const status = error.status;
                if (status == 401) {
                    if (fs.existsSync(this.storeData)) {
                        fs.unlinkSync(this.storeData);
                    }
                    this.terminate('Credentials are wrong, please check and restart', status);
                }

                return null;
            }
        } else {
            this.log.debug('Using auth data from savefile');
        }

        this.loggedInApi = await this.api.withLogin(login);

        //check if User is Admin
        const bindedDevice = await this.loggedInApi.bind_device();

        if (bindedDevice.data.data.length > 0) {
            this.isAdmin = true;
            //this.log.info(`User ist Admin:`);
        } else {
            this.isAdmin = false;
            //this.log.info(`User is not Admin, only read access to own devices.`);
        }

        return login;
    }

    async restoreLoginData(): Promise<LoginResultResponse | null> {
        try {
            this.log.debug('Try to restore data from File');
            const data = await pfs.readFile(this.storeData, 'utf8');
            return JSON.parse(data);
        } catch (err: any) {
            if (err.code === 'ENOENT') {
                this.log.debug(`RestoreLoginData: ${err.message}`);
                return null;
            }
            this.log.debug(`RestoreLoginData: ${err.message}`);
            return null;
        }
    }

    async refreshDate(): Promise<void> {
        let refresh = this.config.POLL_INTERVAL;
        try {
            if (!this.isLoginValid(this.loginData) || this.loginData?.email != this.config.Username) {
                this.loginData = await this.loginAPI();
            }

            if (this.loginData) {
                this.setApiCon(true);

                await this.fetchAndPublish();
            }
        } catch (err: any) {
            this.log.error(`Failed fetching or publishing printer data, Error: ${err}`);
            this.log.debug(`Error Object: ${JSON.stringify(err)}`);
            this.setApiCon(false);
            refresh = this.config.POLL_INTERVAL * 5;
            if (err.status == 401) {
                if (fs.existsSync(this.storeData)) {
                    fs.unlinkSync(this.storeData);
                }
                this.terminate('Credentials are wrong, please check and restart', err);
            }
        } finally {
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

    async refreshAnalysis(): Promise<void> {
        try {
            if (!this.isLoginValid(this.loginData) || this.loginData?.email != this.config.Username) {
                this.loginData = await this.loginAPI();
            }
            if (this.loginData) {
                this.setApiCon(true);
                await this.fetchAndPublishAnalysis();
            }
        } catch (err: any) {
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
            }, 600 * 1000);
            this.log.debug(`Analysis Sleeping for ${600 * 1000}ms... TimerId ${this.refreshAnalysisTimeout}`);
        }
    }

    async fetchAndPublish(): Promise<void> {
        //const loggedInApi = await this.api.withLogin(this.loginData);
        const siteHomepage = await this.loggedInApi.siteHomepage();

        let sites;
        if (siteHomepage.data.site_list.length === 0) {
            // Fallback for Shared Accounts
            sites = (await this.loggedInApi.getSiteList()).data.site_list;
        } else {
            sites = siteHomepage.data.site_list;
        }

        for (const site of sites) {
            const scenInfo = await this.loggedInApi.scenInfo(site.site_id);

            const message = JSON.stringify(scenInfo.data);
            /*
            //DEGUB

            await pfs.writeFile(
                `${utils.getAbsoluteInstanceDataDir(this)}/debug.json`,
                JSON.stringify(scenInfo.data, null, 2),
                'utf8',
            );
            
            const message = await pfs.readFile(`${utils.getAbsoluteInstanceDataDir(this)}/debug.json`, 'utf8');
*/
            const jsonparse = JSON.parse(message);

            this.CreateOrUpdate(site.site_id, site.site_name, 'folder');
            this.CreateOrUpdate(`${site.site_id}.EXTRA`, 'EXTRA', 'folder');

            await this.CreateOrUpdate(
                `${site.site_id}.EXTRA.RAW_JSON`,
                'RAW_JSON',
                'state',
                'string',
                'value',
                false,
                'undefined',
            );
            this.setState(`${site.site_id}.EXTRA.RAW_JSON`, { val: message, ack: true });
            this.parseObjects(`${site.site_id}`, jsonparse);
        }
        this.log.debug('Published Data.');
    }

    async fetchAndPublishAnalysis(): Promise<void> {
        //const loggedInApi = await this.api.withLogin(this.loginData);
        const siteHomepage = await this.loggedInApi.siteHomepage();

        let sites;
        let scenInfo;
        if (siteHomepage.data.site_list.length === 0) {
            // Fallback for Shared Accounts
            sites = (await this.loggedInApi.getSiteList()).data.site_list;
        } else {
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
                const start =
                    range === 'week'
                        ? new Date(date.setDate(date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1)))
                        : new Date();
                const ende = range === 'week' ? new Date(date.setDate(start.getDate() + 6)) : new Date();
                //Solarpoduction Info
                if (
                    this.config.AnalysisSolarproduction &&
                    ((range === 'day' && this.config.AnalysisSolarproductionDay) ||
                        (range === 'week' && this.config.AnalysisSolarproductionWeek))
                ) {
                    try {
                        const energyInfo = await this.loggedInApi.energyAnalysis(
                            site.site_id,
                            '',
                            'week',
                            start,
                            ende,
                            'solar_production',
                        );

                        this.CreateOrUpdate(
                            `${site.site_id}.energyanalysis.solar_production`,
                            `solar_production`,
                            'folder',
                        );
                        this.CreateOrUpdate(
                            `${site.site_id}.energyanalysis.solar_production.${range}`,
                            `${range}`,
                            'folder',
                        );

                        const energy_message = JSON.stringify(energyInfo.data);
                        this.parseObjects(
                            `${site.site_id}.energyanalysis.solar_production.${range}`,
                            JSON.parse(energy_message),
                        );

                        await this.sleep(5000);
                    } catch (err: any) {
                        this.log.debug(`Published Analysis SolarProd ${range} Error: ${err.code}`);
                    }
                }
                //GRID Infos
                if (
                    this.config.AnalysisGrid &&
                    ((range === 'day' && this.config.AnalysisGridDay) ||
                        (range === 'week' && this.config.AnalysisGridWeek))
                ) {
                    try {
                        const gridInfo = await this.loggedInApi.energyAnalysis(
                            site.site_id,
                            '',
                            'week',
                            start,
                            ende,
                            'grid',
                        );
                        this.CreateOrUpdate(`${site.site_id}.energyanalysis.grid`, `grid`, 'folder');
                        this.CreateOrUpdate(`${site.site_id}.energyanalysis.grid.${range}`, `${range}`, 'folder');
                        this.parseObjects(
                            `${site.site_id}.energyanalysis.grid.${range}`,
                            JSON.parse(JSON.stringify(gridInfo.data)),
                        );

                        await this.sleep(5000);
                    } catch (err: any) {
                        this.log.debug(`Published Analysis Grid ${range} Error: ${err.code}`);
                    }
                }

                //HOME_USAGE Infos
                if (
                    this.config.AnalysisHomeUsage &&
                    ((range === 'day' && this.config.AnalysisHomeUsageDay) ||
                        (range === 'week' && this.config.AnalysisHomeUsageWeek))
                ) {
                    if (scenInfoData.grid_info != null) {
                        try {
                            for (const i in scenInfoData.grid_info.grid_list) {
                                if ('device_sn' in scenInfoData.grid_info.grid_list[i]) {
                                    const device_sn = scenInfoData.grid_info.grid_list[i].device_sn;
                                    this.CreateOrUpdate(
                                        `${site.site_id}.energyanalysis.home_usage`,
                                        `home_usage`,
                                        'folder',
                                    );
                                    this.CreateOrUpdate(
                                        `${site.site_id}.energyanalysis.home_usage.${device_sn}`,
                                        `${device_sn}`,
                                        'folder',
                                    );
                                    this.CreateOrUpdate(
                                        `${site.site_id}.energyanalysis.home_usage.${device_sn}.${range}`,
                                        `${range}`,
                                        'folder',
                                    );
                                    const homeusageInfo = await this.loggedInApi.energyAnalysis(
                                        site.site_id,
                                        device_sn,
                                        'week',
                                        start,
                                        ende,
                                        'home_usage',
                                    );

                                    this.parseObjects(
                                        `${site.site_id}.energyanalysis.home_usage.${device_sn}.${range}`,
                                        JSON.parse(JSON.stringify(homeusageInfo.data)),
                                    );
                                }
                            }
                            await this.sleep(5000);
                        } catch (err: any) {
                            this.log.debug(`Published Analysis HomeUsage ${range} Error: ${err.code}`);
                        }
                    } else {
                        this.log.debug(
                            `Published Analysis HomeUsage ${range} Error: No smart meter found, you can disable it in config of instance`,
                        );
                    }
                }
            }
        }
        this.log.debug('Published Analysis Data.');
    }

    whatIsIt(obj: any): 'boolean' | 'number' | 'string' | 'array' | 'object' | 'null' | 'undefined' | undefined {
        if (obj === null) {
            return 'null';
        }
        if (obj === undefined) {
            return 'undefined';
        }
        if (Array.isArray(obj)) {
            return 'array';
        }
        if (typeof obj === 'string') {
            return 'string';
        }
        if (typeof obj === 'boolean') {
            return 'boolean';
        }
        if (typeof obj === 'number') {
            return 'number';
        }
        if (obj != null && typeof obj === 'object') {
            return 'object';
        }
    }
    /**
     * @param key
     * @param jOb
     */
    parseObjects(key: string, jOb: any): void {
        //this.log.debug(`parseObjects : ${JSON.stringify(jOb)}`);
        Object.entries(JSON.parse(JSON.stringify(jOb))).forEach(entries => {
            const [id, value] = entries;

            const type = this.whatIsIt(value);

            if (type === 'array') {
                this.isArray(`${key}.${id}`, value);
            } else if (type === 'object') {
                this.isObject(`${key}.${id}`, value);
            } else {
                this.isString(`${key}.${id}`, value);
            }
        });
    }

    isArray(key: string, value: any): void {
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
                } else if (json.type === '2') {
                    role = 'value';
                    idname = 'total_co2_savings';
                } else if (json.type === '3') {
                    role = 'value';
                    idname = 'total_money_savings';
                }

                //this.log.debug(`array stat:${key}.${idname}, ${json.total}, ${json.unit}, ${role}`);

                this.isString(`${key}.${idname}`, json.total, json.unit, role);
            });
        } else {
            let i: any = '0';
            array.forEach((elem: any, item: any) => {
                if ('device_sn' in array[item]) {
                    i = array[item].device_sn;
                }
                if (this.whatIsIt(array[item]) === 'object') {
                    this.isObject(`${key}.${i}`, array[item]);
                } else if (this.whatIsIt(array[item]) === 'string') {
                    this.isString(`${key}.${i}`, array[item]);
                }

                i++;
            });
        }
    }

    async isObject(key: string, value: any): Promise<void> {
        const name = key.split('.').pop();

        if (value?.device_sn) {
            //if User is Admin, set is_admin to true to all devices
            value = { ...value, is_admin: this.isAdmin };

            this.CreateOrUpdate(key, name, 'device');
        } else {
            this.CreateOrUpdate(key, name, 'folder');
        }
        //this.log.debug(`isObject: ${name}`);

        //calculate battery capacity
        if (value?.device_pn && value?.battery_power && DeviceCapacity[value?.device_pn] > 0) {
            if (value?.battery_power) {
                //this.log.debug(`isObject: ${key}, ${value}`);
                const bat_power: number = value?.battery_power ? value?.battery_power : 0;
                const num_of_batteries = value?.sub_package_num ? value?.sub_package_num : 0;
                let cap = 0;
                if (value?.device_pn) {
                    cap = DeviceCapacity[value?.device_pn];
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
                if (
                    this.config.BatteryBP2700Count == 0 &&
                    this.config.BatteryBP1600Count == 0 &&
                    num_of_batteries > 0
                ) {
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
            const type = this.whatIsIt(objvalue);

            if (type === 'array') {
                this.isArray(`${key}.${objkey}`, objvalue);
            } else if (type === 'object') {
                this.isObject(`${key}.${objkey}`, objvalue);
            } else {
                this.isString(`${key}.${objkey}`, objvalue);
            }
        });
    }

    async isString(key: string, value: any, unit?: string, role: string = 'value'): Promise<void> {
        //this.log.debug(`isString: ${key}`);

        let parmType: ioBroker.CommonType = 'string';
        let parmRole = role;
        let parmUnit = unit ? unit : '';

        const valType = this.whatIsIt(value);

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
            } else if (key.includes('update')) {
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

        if (
            key.includes('_power') &&
            !key.includes('display') &&
            !key.includes('battery') &&
            !key.includes('feature_switch')
        ) {
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
            } else {
                value = +value;
            }
        }

        const name = key.split('.').pop();

        await this.CreateOrUpdate(key, name, 'state', parmType, parmRole, false, parmUnit);
        await this.setState(key, { val: value, ack: true });
    }

    async CreateOrUpdate(
        path: string,
        name: string | undefined = 'Error',
        type: 'state' | 'device' | 'folder' | 'channel',
        commontype: ioBroker.CommonType | undefined = undefined,
        role: string | undefined = undefined,
        writable: boolean | undefined = undefined,
        unit: string | undefined = undefined,
        min: number | undefined = undefined,
        max: number | undefined = undefined,
        step: number | undefined = undefined,
    ): Promise<void> {
        let newObj: any = null;

        if (type === 'state') {
            newObj = {
                type: type,
                common: {
                    name: this.name2id(name),
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
        } else {
            newObj = {
                type: type,
                common: { name: name },
                native: {},
            };
        }
        await this.extendObject(this.name2id(path), newObj);
    }

    isLoginValid(loginData: LoginResultResponse | null, now: Date = new Date()): boolean {
        if (loginData != null) {
            return new Date(loginData.token_expires_at * 1000).getTime() > now.getTime();
        }
        return false;
    }

    name2id(pName: string): string {
        return (pName || '').replace(this.FORBIDDEN_CHARS, '_');
    }

    /**
     * Set api connection status
     *
     * @param status
     */
    async setApiCon(status: boolean): Promise<void> {
        this.apiConnection = status;
        this.setStateChangedAsync('info.apiconnection', { val: status, ack: true });
    }

    rundeAufZehner(value: number, max: number = 800): number {
        const val = Math.round(value / 10) * 10;
        if (val > max) {
            //max 800W Einspeisung
            return max;
        }
        return val;
    }

    async setParam(value: number): Promise<void> {
        try {
            if (!this.isLoginValid(this.loginData) || this.loginData?.email != this.config.Username) {
                this.loginData = await this.loginAPI();
            }
            if (this.loginData) {
                this.setApiCon(true);

                const siteID = this.config.ControlSiteID.split('.')[2];
                const { data: powerLimit } = await this.loggedInApi.getPowerLimit(siteID);
                const roundedValue = this.rundeAufZehner(value, powerLimit.max_power_limit);

                /**/
                const jsonstring =
                    '{"mode_type":3,"custom_rate_plan":[{"index":0,"week":[0,1,2,3,4,5,6],"ranges":[{"start_time":"00:00","end_time":"24:00","power":400}]}],"blend_plan":null,"default_home_load":200,"max_load":800,"min_load":0,"step":10}';
                const config: EnergyConfig = JSON.parse(jsonstring);

                config.mode_type = 3; //3 = Benutzerdefiniert Modus
                config.custom_rate_plan[0].ranges[0].power = roundedValue; //

                await this.loggedInApi.setSiteDeviceParam('6', siteID, JSON.stringify(config));
            }
        } catch (err: any) {
            this.log.error(`setParam: ${err}`);
            this.log.debug(`Error Object: ${JSON.stringify(err)}`);
            this.setApiCon(false);
        }
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    private onUnload(callback: () => void): void {
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

            callback();
        } catch (e: any) {
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
    private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
        if (id === `${this.config.HomeLoadID}` && this.config.EnableControl && this.isAdmin) {
            this.log.info(`HomeLoadID state changed: ${id} - ${JSON.stringify(state)}`);
            const value = state?.val;
            if (typeof value !== 'number') {
                this.log.warn(`HomeLoadID state value is not a number: ${value}`);
            } else {
                //this.log.info(`HomeLoadID state value: ${this.rundeAufZehner(wert)}`);
                this.setParam(value);
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
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Ankersolix2(options);
} else {
    // otherwise start the instance directly
    (() => new Ankersolix2())();
}
