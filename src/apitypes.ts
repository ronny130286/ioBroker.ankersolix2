interface AiEms {
    enable: boolean;
    status: number;
}

interface Range {
    start_time: string;
    end_time: string;
    power: number;
}
interface CustomRatePlan {
    index: number;
    week: number[];
    ranges: Range[];
}
export interface EnergyConfig {
    mode_type: number;
    custom_rate_plan: CustomRatePlan[];
    blend_plan: any;
    use_time: any;
    manual_backup: any;
    reserved_soc: number;
    dynamic_price: any;
    ai_ems: AiEms;
    time_slot: any;
    schedule_mode: any;
    default_home_load: number;
    max_load: number;
    min_load: number;
    step: number;
}

export interface PowerLimit {
    site_id: string;
    power_unit: string;
    legal_power_limit: number;
    device_info: any[];
    current_power: number;
    all_power_limit: number;
    ae100_info: null;
    parallel_type: string;
    ac_input_power_unit: string;
}

export enum ParamType {
    SB1_SCHEDULE = '4',
    SB2_SCHEDULE = '6',
}

export const InverterOutput: Record<string, number[]> = {
    A5143: [600, 800],
    A17C1: [350, 600, 800, 1000],
    A17C2: [350, 600, 800, 1000],
    A17C3: [350, 600, 800, 1000],
    A17C5: [350, 600, 800, 1200],
};

export const DeviceCapacity: Record<string, number> = {
    A17C0: 1600, // SOLIX E1600 Solarbank
    A17C1: 1600, // SOLIX E1600 Solarbank 2 Pro
    A17C2: 1600, // SOLIX E1600 Solarbank 2 AC
    A17C3: 1600, // SOLIX E1600 Solarbank 2 Plus
    A17C5: 2700, // SOLIX E2700 Solarbank 3 Pro
    A1720: 256, // Anker PowerHouse 521 Portable Power Station
    A1722: 288, // SOLIX C300 Portable Power Station
    A1723: 230, // SOLIX C200 Portable Power Station
    A1725: 230, // SOLIX C200 Portable Power Station
    A1726: 288, // SOLIX C300 DC Portable Power Station
    A1727: 230, // SOLIX C200 DC Portable Power Station
    A1728: 288, // SOLIX C300 X Portable Power Station
    A1751: 512, // Anker PowerHouse 535 Portable Power Station
    A1753: 768, // SOLIX C800 Portable Power Station
    A1754: 768, // SOLIX C800 Plus Portable Power Station
    A1755: 768, // SOLIX C800X Portable Power Station
    A1760: 1024, // Anker PowerHouse 555 Portable Power Station
    A1761: 1056, // SOLIX C1000(X) Portable Power Station
    A1770: 1229, // Anker PowerHouse 757 Portable Power Station
    A1771: 1229, // SOLIX F1200 Portable Power Station
    A1772: 1536, // SOLIX F1500 Portable Power Station
    A1780: 2048, // SOLIX F2000 Portable Power Station (PowerHouse 767)
    A1780_1: 2048, // Expansion Battery for F2000
    A1780P: 2048, // SOLIX F2000 Portable Power Station (PowerHouse 767) with WIFI
    A1781: 2560, // SOLIX F2600 Portable Power Station
    A1790: 3840, // SOLIX F3800 Portable Power Station
    A1790_1: 3840, // SOLIX BP3800 Expansion Battery for F3800
    A5220: 5000, // SOLIX X1 Battery module
};
