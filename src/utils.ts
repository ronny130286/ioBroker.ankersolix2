export interface Logger {
    //silly(msg: string): void;
    debug(msg: string): void;
    info(msg: string): void;
    error(msg: string): void;
    warn(msg: string): void;
}
