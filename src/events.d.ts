import Auth from "@eclesia/core-modules-pg/dist/cosmos.auth.v1beta1";
import Bank from "@eclesia/core-modules-pg/dist/cosmos.bank.v1beta1";
import Staking from "@eclesia/core-modules-pg/dist/cosmos.staking.v1beta1";
import { Types } from "@eclesia/indexer-engine";

import {Events as GovEvents } from "./modules/atomone.gov.v1beta1";

declare global {
   
  export interface EventMap
    extends Auth.Events,
    Bank.Events,
    Staking.Events,
    GovEvents,
    Types.Events {}
}
