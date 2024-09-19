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

function isLoginValid(loginData: LoginResultResponse, now: Date = new Date()) {
    return new Date(loginData.token_expires_at * 1000).getTime() > now.getTime();
}
// Load your modules here, e.g.:

class Ankersolix2 extends utils.Adapter {
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

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        //this.log.info('config option1: ' + this.config.S2M_User);
        //this.log.info('config option2: ' + this.config.S2M_Pass);

        /*
		For every state in the system there has to be also an object of type state
		Here a simple template for a boolean variable named "testVariable"
		Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
		*/
        await this.setObjectNotExistsAsync('testVariable', {
            type: 'state',
            common: {
                name: 'testVariable',
                type: 'boolean',
                role: 'indicator',
                read: true,
                write: true,
            },
            native: {},
        });

        if (!this.config.S2M_User || !this.config.S2M_Pass) {
            this.log.error(
                `User name and/or user password empty - please check instance configuration of ${this.namespace}`,
            );
            return;
        }

        if (!this.config.S2M_POLL_INTERVAL || this.config.S2M_POLL_INTERVAL < 30) {
            this.log.error(
                `The poll intervall must be greater than 30 - please check instance configuration of ${this.namespace}`,
            );
            return;
        }

        const storeDir = utils.getAbsoluteInstanceDataDir(this);
        try {
            // create directory
            if (!fs.existsSync(storeDir)) {
                fs.mkdirSync(storeDir);
                this.log.info('Folder created: ' + storeDir);
            }
        } catch (err) {
            this.log.error('Could not create storage directory (' + storeDir + '): ' + err);
            return;
        }

        this.refreshDate();
    }

    async refreshDate(): Promise<void> {
        const start = new Date().getTime();
        try {
            await this.fetchAndPublish();
        } catch (e) {
            this.log.warn('Failed fetching or publishing printer data' + e);
        } finally {
            const end = new Date().getTime() - start;
            const sleepInterval = this.config.S2M_POLL_INTERVAL * 1000 - end;
            this.log.info(`Sleeping for ${sleepInterval}ms...`);
            await sleep(sleepInterval);

            this.refreshDate();
        }
    }

    async fetchAndPublish(): Promise<void> {
        this.log.info('Fetching data');

        const api = new SolixApi({
            username: this.config.S2M_User,
            password: this.config.S2M_Pass,
            country: this.config.S2M_COUNTRY,
            log: this.log,
        });

        const storeDir = utils.getAbsoluteInstanceDataDir(this);

        const persistence: Persistence<LoginResultResponse> = new FilePersistence(storeDir + '/session.data', this.log);

        let loginData = await persistence.retrieve();
        if (loginData == null || !isLoginValid(loginData)) {
            const loginResponse = await api.login();
            loginData = loginResponse.data ?? null;
            if (loginData) {
                await persistence.store(loginData);
            } else {
                this.log.error(`Could not log in: ${loginResponse.msg} (${loginResponse.code})`);
            }
        } else {
            this.log.info('Using cached auth data');
        }

        if (loginData) {
            const loggedInApi = api.withLogin(loginData);
            const siteHomepage = await loggedInApi.siteHomepage();
            //let topic = `${config.mqttTopic}/site_homepage`;
            //await publisher.publish(topic, siteHomepage.data);

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

                Object.entries(jsonparse).forEach((entries) => {
                    const [key, value] = entries;

                    const type = this.whatIsIt(value);

                    if (type === 'object') {
                        this.isAnObject(value, key);
                    } else if (type === 'array') {
                        const array = JSON.parse(JSON.stringify(value));
                        let i = 0;
                        array.forEach((elem: any, item: any) => {
                            if (this.whatIsIt(array[item]) === 'object') {
                                this.isAnObject(array[item], key + '.' + i);
                            } else if (this.whatIsIt(array[item]) === 'string') {
                                this.isAnString(array[item], key + '.' + i);
                            }
                            i++;
                        });
                    } else {
                        this.isAnString(value, key);
                    }
                });

                //fs.writeFileSync(utils.getAbsoluteInstanceDataDir(this) + '/scenInfo.json', message, 'utf8');
            }
            this.log.info('Published.');
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
        if (typeof obj === 'number' || typeof obj === 'bigint') {
            return 'number';
        }
        if (obj != null && typeof obj === 'object') {
            return 'object';
        }
    }

    isAnArray(value: any, key: any): void {
        const array = JSON.parse(JSON.stringify(value));
        array.forEach(async (elem: any, item: any) => {
            const type = this.whatIsIt(array[item]);

            if (type === 'object') {
                this.isAnObject(array[item], key);
            } else if (type === 'string') {
                this.isAnString(array[item], key);
            }
        });
    }

    isAnObject(value: any, key: any): void {
        Object.entries(value).forEach((subentries) => {
            const [subkey, subvalue] = subentries;
            const type = this.whatIsIt(subvalue);
            if (type === 'array') {
                this.isAnArray(subvalue, key + '.' + subkey);
            } else {
                this.isAnString(subvalue, key + '.' + subkey);
            }
        });
    }

    async isAnString(value: any, key: any): Promise<void> {
        await this.setObjectNotExistsAsync(key, {
            type: 'state',
            common: {
                name: key,
                type: 'string',
                role: 'value',
                read: true,
                write: false,
            },
            native: {},
        }).catch((e) => {
            this.log.error(`setObjectNotExists:${e}`);
        });

        this.setState(key, { val: value, ack: true });
        /**/
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
