"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolarbankModeType = exports.DeviceCapacity = exports.InverterOutput = exports.ACLoadCodes = exports.ParamType = void 0;
var ParamType;
(function (ParamType) {
    ParamType["SB1_SCHEDULE"] = "4";
    ParamType["SB2_SCHEDULE"] = "6";
})(ParamType || (exports.ParamType = ParamType = {}));
var ACLoadCodes;
(function (ACLoadCodes) {
    ACLoadCodes["A17C2"] = "A17C2";
    ACLoadCodes["A17C5"] = "A17C5";
})(ACLoadCodes || (exports.ACLoadCodes = ACLoadCodes = {}));
exports.InverterOutput = {
    A5143: [600, 800],
    A17C1: [350, 600, 800, 1000],
    A17C2: [350, 600, 800, 1000],
    A17C3: [350, 600, 800, 1000],
    A17C5: [350, 600, 800, 1200],
};
exports.DeviceCapacity = {
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
var SolarbankModeType;
(function (SolarbankModeType) {
    SolarbankModeType[SolarbankModeType["unknown"] = 0] = "unknown";
    SolarbankModeType[SolarbankModeType["smartmeter"] = 1] = "smartmeter";
    SolarbankModeType[SolarbankModeType["smartplugs"] = 2] = "smartplugs";
    SolarbankModeType[SolarbankModeType["manual"] = 3] = "manual";
    SolarbankModeType[SolarbankModeType["backup"] = 4] = "backup";
    SolarbankModeType[SolarbankModeType["use_time"] = 5] = "use_time";
    SolarbankModeType[SolarbankModeType["smart_learning"] = 6] = "smart_learning";
    SolarbankModeType[SolarbankModeType["smart"] = 7] = "smart";
    SolarbankModeType[SolarbankModeType["time_slot"] = 8] = "time_slot";
    //nicht von Anker
    SolarbankModeType[SolarbankModeType["controlbyadapter"] = 9] = "controlbyadapter";
})(SolarbankModeType || (exports.SolarbankModeType = SolarbankModeType = {}));
//# sourceMappingURL=apitypes.js.map