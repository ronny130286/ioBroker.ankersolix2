// This file extends the AdapterConfig type from "@types/iobroker"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
    namespace ioBroker {
        interface AdapterConfig {
            S2M_User: string;
            S2M_Pass: string;
            S2M_COUNTRY: 'DE' | 'EN';
            S2M_POLL_INTERVAL: number;
            S2M_VERBOSE: boolean;
        }
    }
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
