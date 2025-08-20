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
var func_exports = {};
__export(func_exports, {
  MyFunc: () => MyFunc
});
module.exports = __toCommonJS(func_exports);
var import_apitypes = require("./apitypes");
class MyFunc {
  adapter;
  constructor(adapter) {
    this.adapter = adapter;
  }
  rundeAufZehner(value, max = 800) {
    const val = Math.round(value / 10) * 10;
    if (val > max) {
      return max;
    }
    return val;
  }
  whatIsIt(obj) {
    if (obj === null) {
      return "null";
    }
    if (obj === void 0) {
      return "undefined";
    }
    if (Array.isArray(obj)) {
      return "array";
    }
    if (typeof obj === "string") {
      return "string";
    }
    if (typeof obj === "boolean") {
      return "boolean";
    }
    if (typeof obj === "number") {
      return "number";
    }
    if (obj != null && typeof obj === "object") {
      return "object";
    }
  }
  isLoginValid(loginData, now = /* @__PURE__ */ new Date()) {
    if (loginData != null) {
      return new Date(loginData.token_expires_at * 1e3).getTime() > now.getTime();
    }
    return false;
  }
  name2id(pName) {
    return (pName || "").replace(this.adapter.FORBIDDEN_CHARS, "_");
  }
  isACLoading(value) {
    return Object.values(import_apitypes.ACLoadCodes).includes(value);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MyFunc
});
//# sourceMappingURL=func.js.map
