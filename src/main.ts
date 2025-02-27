/*
 * Created with @iobroker/create-adapter v2.6.3
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';
import fs, { promises as pfs } from 'fs';
import { type LoginResultResponse, SolixApi } from './api';

// Load your modules here, e.g.:

class Ankersolix2 extends utils.Adapter {
    private storeData: string = '';
    private refreshTimeout: any;
    private refreshAnalysisTimeout: any;
    private loginData: LoginResultResponse | null;
    private api: any;
    private apiConnection: boolean;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'ankersolix2',
        });

        this.storeData = `${utils.getAbsoluteInstanceDataDir(this)}/session.data`;
        this.loginData = null;
        this.refreshTimeout = null;
        this.refreshAnalysisTimeout = null;
        this.api = null;
        this.apiConnection = false;
        this.on('ready', this.onReady.bind(this));
        //this.on('stateChange', this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        // Initialize your adapter here

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
        this.refreshAnalysis();
    }

    async loginAPI(): Promise<LoginResultResponse | null> {
        this.api = new SolixApi({
            username: this.config.Username,
            password: this.config.Password,
            country: this.config.COUNTRY,
            log: this.log,
        });

        let login = await this.restoreLoginData();
        if (login) {
            //check if login token not expired
            if (!this.isLoginValid(login)) {
                this.log.debug('loginAPI: token expired');
                login = null;
            }
            //check if username in stored file the same in config
            if (login?.email != this.config.Username) {
                this.log.debug('loginAPI: username are different');
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
        const loggedInApi = await this.api.withLogin(this.loginData);
        const siteHomepage = await loggedInApi.siteHomepage();

        let sites;
        if (siteHomepage.data.site_list.length === 0) {
            // Fallback for Shared Accounts
            sites = (await loggedInApi.getSiteList()).data.site_list;
        } else {
            sites = siteHomepage.data.site_list;
        }

        for (const site of sites) {
            const scenInfo = await loggedInApi.scenInfo(site.site_id);

            const message = JSON.stringify(scenInfo.data);
            const jsonparse = JSON.parse(message);
            /*
            //DEGUB

            await pfs.writeFile(
                `${utils.getAbsoluteInstanceDataDir(this)}/debug.json`,
                JSON.stringify(scenInfo.data, null, 2),
                'utf8',
            );
            
            const message = await pfs.readFile(`${utils.getAbsoluteInstanceDataDir(this)}/debug.json`, 'utf8');
            
            const jsonparse = JSON.parse(message);
            */
            this.CreateOrUpdate(site.site_id, jsonparse.home_info.home_name, 'device');
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

            Object.entries(jsonparse).forEach(entries => {
                const [id, value] = entries;

                const type = this.whatIsIt(value);

                const key = `${site.site_id}.${id}`;

                if (type === 'array') {
                    this.isArray(key, value);
                } else if (type === 'object') {
                    this.isObject(key, value);
                } else {
                    this.isString(key, value);
                }
            });
        }
        this.log.debug('Published Data.');
    }

    async fetchAndPublishAnalysis(): Promise<void> {
        const loggedInApi = await this.api.withLogin(this.loginData);
        const siteHomepage = await loggedInApi.siteHomepage();

        let sites;
        if (siteHomepage.data.site_list.length === 0) {
            // Fallback for Shared Accounts
            sites = (await loggedInApi.getSiteList()).data.site_list;
        } else {
            sites = siteHomepage.data.site_list;
        }

        for (const site of sites) {
            const ranges = ['day', 'week'];

            this.CreateOrUpdate(`${site.site_id}.energyanalysis`, 'energyanalysis', 'folder');

            for (const range of ranges) {
                this.CreateOrUpdate(
                    `${site.site_id}.EXTRA.ENERGY_${range.toUpperCase()}`,
                    'ENERGY_JSON',
                    'state',
                    'string',
                    'value',
                    false,
                    'undefined',
                );

                let energyInfo;
                const date = new Date();
                if (range == 'year') {
                    const startDate = new Date(new Date().getFullYear(), 0, 1);
                    const endDate = new Date(new Date().getFullYear(), 11, 31);

                    energyInfo = await loggedInApi.energyAnalysis(site.site_id, '', range, startDate, endDate);
                } else if (range == 'week') {
                    const start = date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1);
                    const end = start + 6;

                    const startDate = new Date(date.setDate(start));
                    const endDate = new Date(date.setDate(end));
                    energyInfo = await loggedInApi.energyAnalysis(site.site_id, '', range, startDate, endDate);
                } else {
                    energyInfo = await loggedInApi.energyAnalysis(site.site_id, '', 'week', new Date(), new Date());
                }

                this.CreateOrUpdate(`${site.site_id}.energyanalysis.${range}`, `${range}`, 'folder');

                const energy_message = JSON.stringify(energyInfo.data);
                await this.setState(`${site.site_id}.EXTRA.ENERGY_${range.toUpperCase()}`, {
                    val: energy_message,
                    ack: true,
                });

                Object.entries(JSON.parse(energy_message)).forEach(entries => {
                    const [id, value] = entries;

                    const type = this.whatIsIt(value);

                    const key = `${site.site_id}.energyanalysis.${range}.${id}`;

                    if (type === 'array') {
                        this.isArray(key, value);
                    } else if (type === 'object') {
                        this.isObject(key, value);
                    } else {
                        this.isString(key, value);
                    }
                });
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

    isArray(key: string, value: any): void {
        const name = key.split('.').pop();
        this.CreateOrUpdate(`${key}`, name, 'folder');

        const array = JSON.parse(JSON.stringify(value));
        let i: any = '0';

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
            array.forEach((elem: any, item: any) => {
                if ('device_pn' in array[item]) {
                    i = array[item].device_pn;
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

    isObject(key: string, value: any): void {
        const name = key.split('.').pop();
        this.CreateOrUpdate(key, name, 'folder');

        //this.log.debug(`isObject: ${name}`);

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
        let parmUnit = unit;

        const valType = this.whatIsIt(value);

        if (valType === 'boolean') {
            parmType = 'boolean';
        }
        if (valType === 'number') {
            parmType = 'number';
        }

        if (key.includes('time') && !key.includes('backup_info')) {
            parmType = 'string';
            parmRole = 'value.time';

            if (key.includes('create')) {
                value = new Date(value * 1000).toUTCString();
            } else if (key.includes('update')) {
                //when Update_time not set in JSON, set it to actual time
                value = new Date().getTime().toString();
            }
        }

        if (key.includes('_power') && !key.includes('display') && !key.includes('battery')) {
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

        if (key.includes('unit')) {
            switch (value) {
                case 'kWh':
                case 'W':
                    parmRole = 'value.energy';
                    break;
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
    //private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
    //    if (state) {
    //        // The state was changed
    //        this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
    //    } else {
    //        // The state was deleted
    //        this.log.info(`state ${id} deleted`);
    //    }
    // }

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
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Ankersolix2(options);
} else {
    // otherwise start the instance directly
    (() => new Ankersolix2())();
}
