import { type LoginResultResponse } from './api';
import { ACLoadCodes } from './apitypes';

export class MyFunc {
    private readonly adapter: ioBroker.Adapter;
    constructor(adapter: ioBroker.Adapter) {
        this.adapter = adapter;
    }

    public rundeAufZehner(value: number, max: number = 800): number {
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

    public isLoginValid(loginData: LoginResultResponse | null, now: Date = new Date()): boolean {
        if (loginData != null) {
            return new Date(loginData.token_expires_at * 1000).getTime() > now.getTime();
        }
        return false;
    }

    public name2id(pName: string): string {
        return (pName || '').replace(this.adapter.FORBIDDEN_CHARS, '_');
    }

    public isACLoading(value: string): boolean {
        return Object.values(ACLoadCodes).includes(value as ACLoadCodes);
    }
}
