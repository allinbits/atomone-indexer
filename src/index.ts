import { atomoneProtoRegistry } from "@atomone/atomone-types/atomone/client";
import { cosmosProtoRegistry } from "@atomone/atomone-types/cosmos/client";
import { PgIndexer, PgIndexerConfig } from "@clockwork-projects/basic-pg-indexer";
import { Blocks } from "@clockwork-projects/core-modules-pg";

const config: PgIndexerConfig = {
  startHeight: 1058624,
  batchSize: 500,
  modules: [],
  rpcUrl: process.env.RPC_ENDPOINT || "https://rpc.atomone.network",
  logLevel: "debug",
  usePolling: false,
  pollingInterval: 0,
  minimal: true,
  dbConnectionString: process.env.PG_CONNECTION_STRING || "postgres://postgres:password@localhost:5432/atomone",
};

const registry = cosmosProtoRegistry.concat(atomoneProtoRegistry);
const blocksModule = new Blocks.FullBlocksModule(registry);

const indexer = new PgIndexer(config,[blocksModule]);
const run = async () => {
  await indexer.setup();
  await indexer.run();
}
run();