import { TSReader } from "arib-mmt-tlv-ts/ts/reader.js";
import * as wsApi from "./ws_api";
export type DecodeTSOptions = {
    sendCallback: (msg: wsApi.ResponseMessage) => void;
    serviceId?: number;
    parsePES?: boolean;
    dumpError?: boolean;
};
export declare function decodeTS(options: DecodeTSOptions): TSReader;
//# sourceMappingURL=decode_ts_v2.d.ts.map