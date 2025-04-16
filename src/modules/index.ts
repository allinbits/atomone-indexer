import { atomoneProtoRegistry } from "@atomone/atomone-types/atomone/client";
import { cosmosProtoRegistry } from "@atomone/atomone-types/cosmos/client";
import { DB } from "@eclesia/indexer";
import { Auth, Bank, Blocks, Staking } from "@eclesia/sdk-modules";

import * as Gov from "./atomone.gov.v1beta1";

const registry = cosmosProtoRegistry.concat(atomoneProtoRegistry);

export let initialized = false;
export const init = async () => {
  if (!initialized) {
    const dependencies = [
      ...Blocks.depends,
      ...Auth.depends,
      ...Bank.depends,
      ...Staking.depends,
      ...Gov.depends,
    ];
    const provided = [
      ...Blocks.provides,
      ...Auth.provides,
      ...Bank.provides,
      ...Staking.provides,
      ...Gov.provides,
    ];
    for (let i = 0; i < dependencies.length; i++) {
      if (!provided.includes(dependencies[i])) {
        throw new Error(
          "Module '" +
            dependencies[i] +
            "' declared as dependency missing from included modules: "
        );
      }
    }
    await DB.beginTransaction();
    await Blocks.init(registry);
    await Auth.init();
    await Bank.init();
    await Staking.init();
    await Gov.init(registry);
    await DB.endTransaction(true);
    initialized = true;
  }
};
export const modules = [
  Blocks.name,
  Auth.name,
  Bank.name,
  Staking.name,
  Gov.name,
];
