// This file extends the AdapterConfig type from "@types/iobroker"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
    namespace ioBroker {
        interface AdapterConfig {
            Username: string;
            Password: string;
            COUNTRY: 'DE' | 'EN' | 'FR' | 'ES';
            POLL_INTERVAL: number;
        }
    }
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
