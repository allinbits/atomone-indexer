import {
  Events as GovEvents,
} from "./modules/atomone.gov.v1beta1";

declare global {
  // The engine and @eclesia/core-modules-pg augment EventMap with their own events
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface EventMap extends GovEvents {
  }
}
