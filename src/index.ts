import {
  atomoneProtoRegistry,
} from "@atomone/atomone-types/atomone/client.js";
import {
  cosmosProtoRegistry,
} from "@atomone/atomone-types/cosmos/client.js";
import {
  PgIndexer, PgIndexerConfig,
} from "@eclesia/basic-pg-indexer";
import {
  AuthModule, BankModule, Blocks, StakingModule,
} from "@eclesia/core-modules-pg";

import {
  GovModule,
} from "./modules/atomone.gov.v1beta1/index.js";

const config: PgIndexerConfig = {
  startHeight: 1,
  batchSize: Number(process.env.QUEUE_SIZE) || 300,
  modules: [],
  rpcUrl: process.env.RPC_ENDPOINT || "https://rpc.atomone.network",
  logLevel: process.env.LOG_LEVEL as PgIndexerConfig["logLevel"] ?? "info",
  usePolling: false,
  pollingInterval: 0,
  processGenesis: process.env.PROCESS_GENESIS === "true" || false,
  minimal: false,
  genesisPath: "./genesis.json",
  dbConnectionString: process.env.PG_CONNECTION_STRING || "postgres://postgres:password@localhost:5432/atomone",
};

const registry = cosmosProtoRegistry.concat(atomoneProtoRegistry);
const blocksModule = new Blocks.FullBlocksModule(registry);
const authModule = new AuthModule(registry);
const bankModule = new BankModule(registry);
const stakingModule = new StakingModule(registry);
const govModule = new GovModule(registry);
const indexer = new PgIndexer(config, [blocksModule, authModule, bankModule, stakingModule, govModule]);

process.on("unhandledRejection", (reason, promise) => {
  console.log("Unhandled Rejection at:", promise, "reason:", reason);
  console.trace();
  process.exit(1);
});
const run = async () => {
  try {
    await indexer.setup();
    await indexer.run();
  }
  catch (error) {
    console.error("Error running indexer:", error);
    process.exit(1);
  }
};
run();
