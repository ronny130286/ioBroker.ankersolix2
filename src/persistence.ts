import { promises as fs } from 'fs';
import { Logger } from './utils';

export interface Persistence<T> {
    store(data: T): Promise<void>;
    retrieve(): Promise<T | null>;
}

export class FilePersistence<T> implements Persistence<T> {
    constructor(
        private readonly path: string,
        log: Logger,
    ) {
        this.log = log;
        this.path = path;
    }

    private log: Logger;

    async store(data: T): Promise<void> {
        this.log.debug('Write Data to File: ' + this.path);
        await fs.writeFile(this.path, JSON.stringify(data), 'utf8');
    }

    async retrieve(): Promise<T | null> {
        try {
            this.log.debug('Try to restore data from File:' + this.path);
            const data = await fs.readFile(this.path, 'utf8');
            return JSON.parse(data) as T;
        } catch (err) {
            if ((err as any).code === 'ENOENT') {
                return null;
            } else {
                throw err;
            }
        }
    }
}
