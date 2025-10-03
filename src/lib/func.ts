import { type Ankersolix2 } from '../main';
import { type LoginResultResponse } from './api';
import { ACLoadCodes } from './apitypes';
import type { MyTranslate } from './translate';

export class MyFunc {
    private adapter: Ankersolix2;
    private log: ioBroker.Log;
    public myTranslate: MyTranslate;

    constructor(adapter: Ankersolix2) {
        this.adapter = adapter;
        this.log = adapter.log;
        this.myTranslate = adapter.myTranslate;
    }

    /**
     * Rundet Powerwerte auf 10 auf/ab
     *
     * @param value
     * @param max
     * @returns
     */

    public rundeAufZehner(value: number, max: number = 800): number {
        //wenn negativ dann 0
        if (value < 0) {
            return 0;
        }
        const val = Math.round(value / 10) * 10;
        if (val > max) {
            //max 800W Einspeisung
            return max;
        }
        return val;
    }

    public whatIsIt(obj: any): 'boolean' | 'number' | 'string' | 'array' | 'object' | 'null' | 'undefined' | undefined {
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
     * Überprüft ob Token abgelaufen ist
     *
     * @param loginData
     * @param now
     * @returns
     */

    public isLoginValid(loginData: LoginResultResponse | null, now: Date = new Date()): boolean {
        if (loginData != null) {
            return new Date(loginData.token_expires_at * 1000).getTime() > now.getTime();
        }
        return false;
    }

    /**
     * Verhindert das unzulässige Chars im Datenpunkt enthalten sind
     *
     * @param pName
     * @returns
     */

    public name2id(pName: string): string {
        return (pName || '').replace(this.adapter.FORBIDDEN_CHARS, '_');
    }

    /**
     * Gibt zurück ob Geräte über AC Loading verfügt oder nicht
     *
     * @param value
     * @returns
     */

    public isACLoading(value: string): boolean {
        return Object.values(ACLoadCodes).includes(value as ACLoadCodes);
    }

    /**
     * Prüft ob sich Zeiten zu Wochentagen überschneiden
     *
     * @param entries
     * @returns
     */

    public hasTimeOverlap(entries: any[]): string | boolean {
        const dayMap = new Map<number, { start: number; end: number }[]>();

        for (const entry of entries) {
            const days = entry.week.split(',').map(Number);
            const startParts = entry.start_time.split(':').map(Number);
            const endParts = entry.end_time.split(':').map(Number);

            const startMinutes = startParts[0] * 60 + startParts[1];
            const endMinutes = endParts[0] * 60 + endParts[1];

            for (const day of days) {
                if (!dayMap.has(day)) {
                    dayMap.set(day, []);
                }
                dayMap.get(day)!.push({ start: startMinutes, end: endMinutes });
            }
        }

        // Prüfe pro Tag auf Überschneidungen
        for (const [day, ranges] of dayMap.entries()) {
            const sorted = ranges.sort((a, b) => a.start - b.start);

            for (let i = 1; i < sorted.length; i++) {
                const prev = sorted[i - 1];
                const curr = sorted[i];

                if (curr.start < prev.end) {
                    //const errortext = this.myTranslate.getTranslation('Overlapping at day ${day}: ${start} < ${end}');
                    const errortext = this.myTranslate.getTranslation('Overlapping at day %s0: %s1 < %s2');
                    /*
                    const returntext = errortext
                        .replace('${day}', day.toString())
                        .replace('${start}', this.formatTime(curr.start))
                        .replace('${end}', this.formatTime(prev.end));
                        */
                    const returntext = this.format(
                        errortext,
                        day.toString(),
                        this.formatTime(curr.start),
                        this.formatTime(prev.end),
                    );
                    return returntext;
                }
            }
        }

        return false;
    }

    /**
     * Formatiert Minuten in HH:MM
     *
     * @param minutes
     * @returns
     */

    private formatTime(minutes: number): string {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    public cleanseWithRules<T>(obj: T, rules: { [key: string]: string[] }): T {
        const isEmpty = (value: any): boolean => {
            return (
                value === null ||
                value === '' ||
                //value === '0' ||
                value === '0.00' ||
                //value === '1970-01-01 00:00:00' ||
                //value === '01-01-0001 00:00:00' ||
                (Array.isArray(value) && value.length === 0) ||
                (typeof value === 'object' && value !== null && Object.keys(value).length === 0)
            );
        };

        const cleanse = (input: any): any => {
            if (Array.isArray(input)) {
                return input.map(cleanse).filter(item => !isEmpty(item));
            }

            if (typeof input === 'object' && input !== null) {
                const result: any = {};

                for (const [key, value] of Object.entries(input)) {
                    result[key] = cleanse(value);
                }

                // Immer löschen
                for (const key of rules.always ?? []) {
                    delete result[key];
                }

                // Regelbasierte Entfernung ganzer Abschnitte
                for (const [sectionKey, arrayKeys] of Object.entries(rules.conditional ?? {})) {
                    const section = result[sectionKey];
                    if (!section || typeof section !== 'object') {
                        continue;
                    }

                    const shouldRemove = (arrayKeys as unknown as string[]).every((arrayKey: string) => {
                        const value = (section as Record<string, unknown>)[arrayKey];
                        return !value || (Array.isArray(value) && value.length === 0);
                    });

                    if (shouldRemove) {
                        delete result[sectionKey];
                    }
                }

                // Entferne leere Felder nach der Regelprüfung
                for (const key of Object.keys(result)) {
                    if (isEmpty(result[key])) {
                        delete result[key];
                    }
                }

                return result;
            }

            return input;
        };

        return cleanse(obj);
    }

    public format(template: string, ...args: any[]): string {
        return template.replace(
            /%(?:(\d*\.\d+)f|s(\d*)|d(\d*)|b(\d*)|t(\d*)\(([^)]+)\)|T(\d*)\(([^)]+)\))/g,
            (match, floatFmt, sIndex, dIndex, bIndex, tIndex, tFormat, TIndex, TFormat) => {
                // Float mit Format (%0.2f)
                if (floatFmt) {
                    const value = args.shift();
                    const precision = Number(floatFmt.split('.')[1]);
                    return Number(value).toFixed(precision);
                }

                // String (%s0, %s1, ...)
                if (sIndex !== undefined) {
                    const value = args[Number(sIndex)];
                    return String(value);
                }

                // Integer (%d0, %d1, ...)
                if (dIndex !== undefined) {
                    const value = args[Number(dIndex)];
                    return Number(value).toString();
                }

                // Boolean (%b0, %b1, ...)
                if (bIndex !== undefined) {
                    const value = args[Number(bIndex)];
                    return value ? 'true' : 'false';
                }

                // Datum (%t0(...))
                if (tFormat !== undefined) {
                    const date = new Date(args[Number(tIndex)]);
                    return tFormat
                        .replace('YYYY', date.getFullYear().toString())
                        .replace('MM', String(date.getMonth() + 1).padStart(2, '0'))
                        .replace('DD', String(date.getDate()).padStart(2, '0'))
                        .replace('HH', String(date.getHours()).padStart(2, '0'))
                        .replace('mm', String(date.getMinutes()).padStart(2, '0'))
                        .replace('ss', String(date.getSeconds()).padStart(2, '0'));
                }

                // Uhrzeit (%T1(...))
                if (TFormat !== undefined) {
                    const date = new Date(args[Number(TIndex)]);
                    return TFormat.replace('YYYY', date.getFullYear().toString())
                        .replace('MM', String(date.getMonth() + 1).padStart(2, '0'))
                        .replace('DD', String(date.getDate()).padStart(2, '0'))
                        .replace('HH', String(date.getHours()).padStart(2, '0'))
                        .replace('mm', String(date.getMinutes()).padStart(2, '0'))
                        .replace('ss', String(date.getSeconds()).padStart(2, '0'));
                }

                return match; // Fallback
            },
        );
    }
}
