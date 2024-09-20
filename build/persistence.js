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
var persistence_exports = {};
__export(persistence_exports, {
  FilePersistence: () => FilePersistence
});
module.exports = __toCommonJS(persistence_exports);
var import_fs = require("fs");
class FilePersistence {
  constructor(path, log) {
    this.path = path;
    this.log = log;
    this.path = path;
  }
  log;
  async store(data) {
    this.log.debug("Write Data to File: " + this.path);
    await import_fs.promises.writeFile(this.path, JSON.stringify(data), "utf8");
  }
  async retrieve() {
    try {
      this.log.debug("Try to restore data from File:" + this.path);
      const data = await import_fs.promises.readFile(this.path, "utf8");
      return JSON.parse(data);
    } catch (err) {
      if (err.code === "ENOENT") {
        return null;
      } else {
        throw err;
      }
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FilePersistence
});
//# sourceMappingURL=persistence.js.map
