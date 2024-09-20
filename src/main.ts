/*
 * Created with @iobroker/create-adapter v2.6.3
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';
import fs from 'fs';
import { LoginResultResponse, SolixApi } from './api.js';
import { FilePersistence, Persistence } from './persistence.js';
import { sleep } from './utils.js';

// Load your modules here, e.g.:

class Ankersolix2 extends utils.Adapter {
    storeDir = utils.getAbsoluteInstanceDataDir(this);

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'ankersolix2',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
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

        if (!this.config.POLL_INTERVAL || this.config.POLL_INTERVAL < 30) {
            this.log.error(
                `The poll intervall must be greater than 30 - please check instance configuration of ${this.namespace}`,
            );
            return;
        }

        try {
            // create directory to store fetch data
            if (!fs.existsSync(this.storeDir)) {
                fs.mkdirSync(this.storeDir);
                this.log.debug('Folder created: ' + this.storeDir);
            }
        } catch (err) {
            this.log.error('Could not create storage directory (' + this.storeDir + '): ' + err);
            return;
        }

        this.refreshDate();
    }

    async refreshDate(): Promise<void> {
        const start = new Date().getTime();
        try {
            await this.fetchAndPublish();
        } catch (e) {
            //looking for session.data, delete if exist, so get a new token. Problem happen if use the same account in App
            if (fs.existsSync(this.storeDir + '/session.data')) {
                fs.unlinkSync(this.storeDir + '/session.data');
            }
            this.log.warn('Failed fetching or publishing printer data' + e);
        } finally {
            const end = new Date().getTime() - start;
            const sleepInterval = this.config.POLL_INTERVAL * 1000 - end;
            this.log.debug(`Sleeping for ${sleepInterval}ms...`);
            await sleep(sleepInterval);

            this.refreshDate();
        }
    }

    async fetchAndPublish(): Promise<void> {
        this.log.debug('Fetching data');

        const api = new SolixApi({
            username: this.config.Username,
            password: this.config.Password,
            country: this.config.COUNTRY,
            log: this.log,
        });

        const persistence: Persistence<LoginResultResponse> = new FilePersistence(
            this.storeDir + '/session.data',
            this.log,
        );

        let loginData = await persistence.retrieve();
        if (loginData == null || !this.isLoginValid(loginData)) {
            const loginResponse = await api.login();
            loginData = loginResponse.data ?? null;
            if (loginData) {
                await persistence.store(loginData);
            } else {
                this.log.error(`Could not log in: ${loginResponse.msg} (${loginResponse.code})`);
            }
        } else {
            this.log.debug('Using cached auth data');
        }

        if (loginData) {
            const loggedInApi = api.withLogin(loginData);
            const siteHomepage = await loggedInApi.siteHomepage();

            this.log.debug('siteHomepage Data: ' + JSON.stringify(siteHomepage.data.site_list));

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

                this.CreateOrUpdateFolder(site.site_id, jsonparse.home_info.home_name, 'device');

                Object.entries(jsonparse).forEach((entries) => {
                    const [id, value] = entries;

                    const type = this.whatIsIt(value);

                    const key = site.site_id + '.' + id;

                    if (type === 'object') {
                        this.isObject(key, value);
                    } else if (type === 'array') {
                        const array = JSON.parse(JSON.stringify(value));
                        let i = 0;
                        array.forEach((elem: any, item: any) => {
                            if (this.whatIsIt(array[item]) === 'object') {
                                this.isObject(key + '.' + i, array[item]);
                            } else if (this.whatIsIt(array[item]) === 'string') {
                                this.isString(key + '.' + i, array[item]);
                            }
                            i++;
                        });
                    } else {
                        this.isString(key, value);
                    }
                });

                //fs.writeFileSync(utils.getAbsoluteInstanceDataDir(this) + '/scenInfo.json', message, 'utf8');
            }
            this.log.debug('Published.');
        } else {
            this.log.error('Not logged in');
        }
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
        const array = JSON.parse(JSON.stringify(value));
        array.forEach(async (elem: any, item: any) => {
            const type = this.whatIsIt(array[item]);

            if (type === 'object') {
                this.isObject(key, array[item]);
            } else if (type === 'string') {
                this.isString(key, array[item]);
            }
        });
    }

    isObject(key: string, value: any): void {
        const name = key.split('.').pop()?.replaceAll('_', ' ');
        this.CreateOrUpdateFolder(key, name, 'folder');
        Object.entries(value).forEach((subentries) => {
            const [objkey, objvalue] = subentries;
            const type = this.whatIsIt(objvalue);
            if (type === 'array') {
                this.isArray(key + '.' + objkey, objvalue);
            } else {
                this.isString(key + '.' + objkey, objvalue);
            }
        });
    }

    async isString(key: string, value: any): Promise<void> {
        let parmType: ioBroker.CommonType = 'string';
        let parmRole: string = 'value';
        const valType = this.whatIsIt(value);

        if (valType === 'boolean') {
            parmType = 'boolean';
        }
        if (valType === 'number') {
            parmType = 'number';
        }
        if (key.includes('time')) {
            parmType = 'string';
            parmRole = 'value.time';
            if (valType === 'number') {
                value = new Date(value * 1000).toUTCString();
            }
        }
        if (key.includes('unit')) {
            switch (value) {
                case 'kWh':
                    parmRole = 'value.energy';
                    break;
                case 'W':
                    parmRole = 'value.energy';
                    break;
                default:
                    break;
            }
        }
        let parmUnit = undefined;
        if (key.includes('_power') && !key.includes('display')) {
            parmUnit = 'W';
        }

        const name = key.split('.').pop()?.replaceAll('_', ' ');

        await this.CreateOrUpdateState(key, name, parmType, parmRole, false, parmUnit);
        this.setState(key, { val: value, ack: true });
    }

    async CreateOrUpdateFolder(
        path: string,
        name: string | undefined = 'error',
        type: 'folder' | 'device' | 'channel',
    ): Promise<void> {
        const obj = await this.getObjectAsync(path);
        if (obj == null) {
            this.log.debug(path + ' doesnt exist => create');
            const newObj: ioBroker.SettableObject = {
                type: type,
                common: { name: name },
                native: {},
            };
            await this.setObjectAsync(path, newObj);
        } else {
            this.log.debug(path + ' exist => looking for update');
            let changed: boolean = false;
            if (obj.common.name != name) {
                obj.common.name = name;
                changed = true;
            }
            if (obj.common.type != type) {
                obj.common.type = type;
                changed = true;
            }
            if (changed) {
                this.log.debug(path + ' => has been updated');
                await this.setObjectAsync(path, obj);
            }
        }
    }

    async CreateOrUpdateState(
        path: string,
        name: string | undefined = 'Error',
        type: ioBroker.CommonType,
        role: string,
        writable: boolean,
        unit: string | undefined = undefined,
        min: number | undefined = undefined,
        max: number | undefined = undefined,
        step: number | undefined = undefined,
    ): Promise<void> {
        const obj = await this.getObjectAsync(path);
        if (obj == null) {
            this.log.debug(path + ' doesnt exist => create');
            const newObj: ioBroker.SettableObject = {
                type: 'state',
                common: {
                    name: name,
                    type: type,
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
            await this.setObjectAsync(path, newObj);
        } else {
            this.log.debug(path + ' exist => looking for update');
            let changed: boolean = false;
            if (obj.common == null) {
                obj.common = {
                    name: name,
                    type: 'string',
                    role: role,
                    read: true,
                    write: writable,
                    unit: unit,
                    min: min,
                    max: max,
                    step: step,
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
                    this.log.debug(path + ' => has been updated');
                    await this.setObjectAsync(path, obj);
                }
            }
        }
    }

    getJSON(value: string): Promise<void> {
        return JSON.parse(JSON.stringify(value));
    }

    isLoginValid(loginData: LoginResultResponse, now: Date = new Date()): boolean {
        return new Date(loginData.token_expires_at * 1000).getTime() > now.getTime();
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

            callback();
        } catch (e) {
            this.log.error('onUnload: ' + e);
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
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
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
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Ankersolix2(options);
} else {
    // otherwise start the instance directly
    (() => new Ankersolix2())();
}
