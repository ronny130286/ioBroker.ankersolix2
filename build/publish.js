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
var publish_exports = {};
__export(publish_exports, {
  Publisher: () => Publisher
});
module.exports = __toCommonJS(publish_exports);
var import_async_mqtt = require("async-mqtt");
class Publisher {
  constructor(url, retain, clientId, username, password) {
    this.url = url;
    this.retain = retain;
    this.clientId = clientId;
    this.username = username;
    this.password = password;
  }
  client;
  async getClient() {
    var _a;
    if (this.client && this.client.connected) {
      return this.client;
    }
    await ((_a = this.client) == null ? void 0 : _a.end());
    this.client = await (0, import_async_mqtt.connectAsync)(this.url, {
      clientId: this.clientId,
      username: this.username,
      password: this.password
    });
    return this.client;
  }
  async publish(topic, message) {
    await (await this.getClient()).publish(topic, JSON.stringify(message), { retain: this.retain });
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Publisher
});
//# sourceMappingURL=publish.js.map
