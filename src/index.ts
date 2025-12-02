import {
  atomoneProtoRegistry,
} from "@atomone/atomone-types/atomone/client.js";
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

const config: PgIndexerConfig = {
  startHeight: Number(process.env.START_HEIGHT) || 1,
  batchSize: Number(process.env.QUEUE_SIZE) || 300,
  modules: process.env.MODULES ? process.env.MODULES.split(",") : [],
  rpcUrl: process.env.RPC_ENDPOINT || "https://rpc.atomone.network",
  logLevel: process.env.LOG_LEVEL as PgIndexerConfig["logLevel"] ?? "info",
  usePolling: process.env.USE_POLLING === "true" || false,
  processGenesis: process.env.PROCESS_GENESIS === "true" || false,
  enablePrometheus: process.env.ENABLE_PROMETHEUS === "false" ? false : true,
  prometheusPort: Number(process.env.PROMETHEUS_PORT) || 9090,
  enableHealthcheck: process.env.ENABLE_HEALTHCHECK === "false" ? false : true,
  healthCheckPort: Number(process.env.HEALTHCHECK_PORT) || 8080,
  minimal: process.env.MINIMAL === "true" || false,
  genesisPath: process.env.GENESIS_PATH || "./genesis.json",
  dbConnectionString: process.env.PG_CONNECTION_STRING || "postgres://postgres:password@localhost:5432/atomone",
};

const registry = defaultRegistryTypes.concat(atomoneProtoRegistry);
const blocksModule = new Blocks.FullBlocksModule(registry);
const authModule = new AuthModule(registry);
const bankModule = new BankModule(registry);
const stakingModule = new StakingModule(registry);
const govModule = new GovModule(registry);
const indexer = new PgIndexer(config, [blocksModule, authModule, bankModule, stakingModule, govModule]);

indexer.indexer.on("fatal-error", (error) => {
  console.error("Fatal error in indexer:", error);
  console.trace();
  process.exit(1);
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
