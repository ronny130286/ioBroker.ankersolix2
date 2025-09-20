import { readFile } from 'fs/promises';
import { join } from 'path';
import { type Ankersolix2 } from '../main';

export class MyTranslate {
    private adapter: Ankersolix2;
    private log: ioBroker.Log;
    translation: { [key: string]: string } = {};
    language: ioBroker.Languages = 'en';

    constructor(adapter: Ankersolix2, _options: any = null) {
        this.adapter = adapter;
        this.log = adapter.log;
    }

    /**
     * Initializes the Library by setting the language based on the system configuration.
     * If the system configuration's language is not available, defaults to English.
     *
     * @returns A promise that resolves when initialization is complete.
     */
    async init(): Promise<void> {
        const obj = await this.adapter.getForeignObjectAsync('system.config');
        if (obj) {
            await this.setLanguage(obj.common.language, true);
        } else {
            await this.setLanguage('en', true);
        }
    }

    /**
     * Get the local language as a string
     * The language is determined from the admin settings and is 'en-En' if no language is set
     *
     * @returns The local language as a string
     */
    getLocalLanguage(): string {
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
    getTranslation(key: string): string {
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
    existTranslation(key: string): boolean {
        return this.translation[key] !== undefined;
    }

    /**
     * Return the translation of the given key for all languages
     * If no translation is found the key itself is returned
     *
     * @param key The key to translate
     * @returns The translated string or a object with the translations for all languages
     */
    async getTranslationObj(key: string): Promise<ioBroker.StringOrTranslated> {
        const language: ioBroker.Languages[] = ['en', 'de', 'ru', 'pt', 'nl', 'fr', 'it', 'es', 'pl', 'uk', 'zh-cn'];
        const result: { [key: string]: string } = {};
        for (const l of language) {
            try {
                const i = await import(`../../admin/i18n/${l}/translations.json`);
                if (i[key] !== undefined) {
                    result[l as string] = i[key];
                }
            } catch {
                return key;
            }
        }
        if (result.en == undefined) {
            return key;
        }
        return result as ioBroker.StringOrTranslated;
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
    async setLanguage(language: ioBroker.Languages, force = false): Promise<boolean> {
        if (!language) {
            language = 'en';
        }
        if (force || this.language != language) {
            try {
                const filePath = join(__dirname, `../../admin/i18n/${language}/translations.json`);
                const content = await readFile(filePath, 'utf8');
                this.translation = JSON.parse(content);
                this.language = language;
                return true;
            } catch (err: any) {
                this.log.error(`Language ${language} not exist! Error: ${err}`);
            }
        }
        return false;
    }
}
