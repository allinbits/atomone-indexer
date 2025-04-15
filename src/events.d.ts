import { Types } from "@clockwork-projects/indexer-engine";
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface EventMap
    extends
      Types.Events {}
}
