"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var apitypes_exports = {};
__export(apitypes_exports, {
  ACLoadCodes: () => ACLoadCodes,
  DeviceCapacity: () => DeviceCapacity,
  InverterOutput: () => InverterOutput,
  ParamType: () => ParamType
});
module.exports = __toCommonJS(apitypes_exports);
var ParamType = /* @__PURE__ */ ((ParamType2) => {
  ParamType2["SB1_SCHEDULE"] = "4";
  ParamType2["SB2_SCHEDULE"] = "6";
  return ParamType2;
})(ParamType || {});
var ACLoadCodes = /* @__PURE__ */ ((ACLoadCodes2) => {
  ACLoadCodes2["A17C2"] = "A17C2";
  ACLoadCodes2["A17C5"] = "A17C5";
  return ACLoadCodes2;
})(ACLoadCodes || {});
const InverterOutput = {
  A5143: [600, 800],
  A17C1: [350, 600, 800, 1e3],
  A17C2: [350, 600, 800, 1e3],
  A17C3: [350, 600, 800, 1e3],
  A17C5: [350, 600, 800, 1200]
};
const DeviceCapacity = {
  A17C0: 1600,
  // SOLIX E1600 Solarbank
  A17C1: 1600,
  // SOLIX E1600 Solarbank 2 Pro
  A17C2: 1600,
  // SOLIX E1600 Solarbank 2 AC
  A17C3: 1600,
  // SOLIX E1600 Solarbank 2 Plus
  A17C5: 2700,
  // SOLIX E2700 Solarbank 3 Pro
  A1720: 256,
  // Anker PowerHouse 521 Portable Power Station
  A1722: 288,
  // SOLIX C300 Portable Power Station
  A1723: 230,
  // SOLIX C200 Portable Power Station
  A1725: 230,
  // SOLIX C200 Portable Power Station
  A1726: 288,
  // SOLIX C300 DC Portable Power Station
  A1727: 230,
  // SOLIX C200 DC Portable Power Station
  A1728: 288,
  // SOLIX C300 X Portable Power Station
  A1751: 512,
  // Anker PowerHouse 535 Portable Power Station
  A1753: 768,
  // SOLIX C800 Portable Power Station
  A1754: 768,
  // SOLIX C800 Plus Portable Power Station
  A1755: 768,
  // SOLIX C800X Portable Power Station
  A1760: 1024,
  // Anker PowerHouse 555 Portable Power Station
  A1761: 1056,
  // SOLIX C1000(X) Portable Power Station
  A1770: 1229,
  // Anker PowerHouse 757 Portable Power Station
  A1771: 1229,
  // SOLIX F1200 Portable Power Station
  A1772: 1536,
  // SOLIX F1500 Portable Power Station
  A1780: 2048,
  // SOLIX F2000 Portable Power Station (PowerHouse 767)
  A1780_1: 2048,
  // Expansion Battery for F2000
  A1780P: 2048,
  // SOLIX F2000 Portable Power Station (PowerHouse 767) with WIFI
  A1781: 2560,
  // SOLIX F2600 Portable Power Station
  A1790: 3840,
  // SOLIX F3800 Portable Power Station
  A1790_1: 3840,
  // SOLIX BP3800 Expansion Battery for F3800
  A5220: 5e3
  // SOLIX X1 Battery module
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ACLoadCodes,
  DeviceCapacity,
  InverterOutput,
  ParamType
});
//# sourceMappingURL=apitypes.js.map
