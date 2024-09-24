export async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface Logger {
    //silly(msg: string): void;
    debug(msg: string): void;
    info(msg: string): void;
    error(msg: string): void;
    warn(msg: string): void;
}
