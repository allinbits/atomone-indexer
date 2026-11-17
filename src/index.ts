import {
  atomoneProtoRegistry,
} from "@atomone/atomone-types/atomone/client.js";
import {
  cosmosProtoRegistry,
} from "@atomone/atomone-types/cosmos/client.js";
import {
  defaultRegistryTypes,
} from "@cosmjs/stargate";
import {
  PgIndexer, PgIndexerConfig,
} from "@eclesia/basic-pg-indexer";
import {
  AuthModule, BankModule, Blocks, StakingModule,
} from "@eclesia/core-modules-pg";

import {
  GovModule,
} from "./modules/atomone.gov.v1beta1/index.js";
import {
  SupplyModule,
} from "./modules/supply/index.js";

const config: PgIndexerConfig = {
  startHeight: Number(process.env.CHAIN_START_HEIGHT) || 1,
  batchSize: Number(process.env.QUEUE_SIZE) || 300,
  modules: [],
  rpcUrl: process.env.RPC_ENDPOINT || "https://rpc.atomone.network",
  logLevel: process.env.LOG_LEVEL as PgIndexerConfig["logLevel"] ?? "info",
  usePolling: process.env.USE_POLLING === "true" || false,
  processGenesis: process.env.PROCESS_GENESIS === "true" || false,
  enablePrometheus: true,
  prometheusPort: Number(process.env.PROMETHEUS_PORT) || 9090,
  enableHealthcheck: true,
  healthCheckPort: Number(process.env.HEALTHCHECK_PORT) || 8080,
  minimal: false,
  genesisPath: process.env.GENESIS_PATH || "./genesis.json",
  dbConnectionString: process.env.PG_CONNECTION_STRING || "postgres://postgres:password@localhost:5432/atomone",
};

const registry = cosmosProtoRegistry.concat(atomoneProtoRegistry);
for (const [typeUrl, generatedType] of defaultRegistryTypes) {
  if (registry.find(([url]) => url === typeUrl)) {
    continue;
  }
  registry.push([typeUrl, generatedType]);
}
const blocksModule = new Blocks.FullBlocksModule(registry);
const authModule = new AuthModule(registry);
const bankModule = new BankModule(registry);
const stakingModule = new StakingModule(registry);
const govModule = new GovModule(registry);

const supplyModule = new SupplyModule(registry);
const indexer = new PgIndexer(config, [blocksModule, authModule, bankModule, stakingModule, govModule, supplyModule]);

indexer.indexer.on("fatal-error", (error) => {
  // PgIndexer stops the engine and exits the process once this listener has run
  console.error("Fatal error in indexer:", error);
});
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
