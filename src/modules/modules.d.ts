import { Types } from "@eclesia/indexer";
import { Auth, Bank, Staking } from "@eclesia/sdk-modules";

import * as Gov from "./atomone.gov.v1beta1";
declare global {
  export interface EventMap
    extends Auth.Events,
      Bank.Events,
      Staking.Events,
      Gov.Events,
      Types.Events {}
}
