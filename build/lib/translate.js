"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MyTranslate = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
class MyTranslate {
    adapter;
    log;
    translation = {};
    language = 'en';
    constructor(adapter, _options = null) {
        this.adapter = adapter;
        this.log = adapter.log;
    }
    /**
     * Initializes the Library by setting the language based on the system configuration.
     * If the system configuration's language is not available, defaults to English.
     *
     * @returns A promise that resolves when initialization is complete.
     */
    async init() {
        const obj = await this.adapter.getForeignObjectAsync('system.config');
        if (obj) {
            await this.setLanguage(obj.common.language, true);
        }
        else {
            await this.setLanguage('en', true);
        }
    }
    /**
     * Get the local language as a string
     * The language is determined from the admin settings and is 'en-En' if no language is set
     *
     * @returns The local language as a string
     */
    getLocalLanguage() {
        if (this.language) {
            return this.language;
        }
        return 'en-En';
    }
    /**
     * Return the translation of the given key
     * If no translation is found the key itself is returned
     *
     * @param key The key to translate
     * @returns The translated string
     */
    getTranslation(key) {
        if (this.translation[key] !== undefined) {
            return this.translation[key];
        }
        return key;
    }
    /**
     * Checks if a translation exists for the given key.
     *
     * @param key The key to check for translation.
     * @returns True if the translation exists, otherwise false.
     */
    existTranslation(key) {
        return this.translation[key] !== undefined;
    }
    /**
     * Return the translation of the given key for all languages
     * If no translation is found the key itself is returned
     *
     * @param key The key to translate
     * @returns The translated string or a object with the translations for all languages
     */
    async getTranslationObj(key) {
        const language = ['en', 'de', 'ru', 'pt', 'nl', 'fr', 'it', 'es', 'pl', 'uk', 'zh-cn'];
        const result = {};
        for (const l of language) {
            try {
                const i = await import(`../../admin/i18n/${l}/translations.json`);
                if (i[key] !== undefined) {
                    result[l] = i[key];
                }
            }
            catch {
                return key;
            }
        }
        if (result.en == undefined) {
            return key;
        }
        return result;
    }
    /**
     * Sets the language for all getTranslation and getTranslationObj calls.
     * If the language does not exist, it will not be changed and an error message will be logged.
     * If force is true, the language will be changed even if it is already set.
     *
     * @param language The language to set.
     * @param force Set to true to force the language to be changed.
     * @returns True if the language was changed, otherwise false.
     */
    async setLanguage(language, force = false) {
        if (!language) {
            language = 'en';
        }
        if (force || this.language != language) {
            try {
                const filePath = (0, path_1.join)(__dirname, `../../admin/i18n/${language}/translations.json`);
                const content = await (0, promises_1.readFile)(filePath, 'utf8');
                this.translation = JSON.parse(content);
                this.language = language;
                return true;
            }
            catch (err) {
                this.log.error(`Language ${language} not exist! Error: ${err}`);
            }
        }
        return false;
    }
}
exports.MyTranslate = MyTranslate;
//# sourceMappingURL=translate.js.map