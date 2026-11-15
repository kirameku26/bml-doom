import { TsStream } from "@chinachu/aribts";
import * as wsApi from "./ws_api";
export type DecodeTSOptions = {
    sendCallback: (msg: wsApi.ResponseMessage) => void;
    serviceId?: number;
    parsePES?: boolean;
    dumpError?: boolean;
};
export declare function decodeTS(options: DecodeTSOptions): TsStream;
//# sourceMappingURL=decode_ts%20copy.d.ts.map