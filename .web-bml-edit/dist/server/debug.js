"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_process_1 = __importDefault(require("node:process"));
const decode_ts_1 = require("./decode_ts");
const decode_ts_v2_1 = require("./decode_ts_v2");
console.log(node_process_1.default.argv[1]);
async function main() {
    const v1 = (0, decode_ts_1.decodeTS)({ sendCallback(msg) {
            console.log({ v: 2, msg: msg });
        }, });
    v1.on("data", () => { });
    const v2 = (0, decode_ts_v2_1.decodeTS)({ sendCallback(msg) {
            console.log({ v: 2, msg: msg });
        }, });
    for await (const block of (0, node_fs_1.createReadStream)(node_process_1.default.argv[1])) {
        v1.write(block);
        v2.push(block);
    }
}
main();
//# sourceMappingURL=debug.js.map