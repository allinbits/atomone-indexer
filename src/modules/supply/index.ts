import * as fs from "node:fs";
import * as path from "node:path";
import {
  fileURLToPath,
} from "node:url";

import {
  QueryTotalSupplyRequest, QueryTotalSupplyResponse,
} from "@atomone/atomone-types/cosmos/bank/v1beta1/query.js";
import {
  GeneratedType,
} from "@cosmjs/proto-signing";
import {
  PgIndexer,
} from "@eclesia/basic-pg-indexer";
import {
  EcleciaIndexer, Types,
} from "@eclesia/indexer-engine";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the new indexing event we want to listen for
export type Events = {

  "/atomone.photon.v1.MsgMintPhoton": {
    value: Types.TxResult<Uint8Array>
  }
};

export class SupplyModule implements Types.IndexingModule {
  indexer!: EcleciaIndexer;

  private pgIndexer!: PgIndexer;

  private registry: [string, GeneratedType][];

  // Give our module a name
  public name: string = "supply";

  // If our module depends on other modules, list their names here
  public depends: string[] = [];

  // If a different module makes use of the data we generate, let's name our module as a provider
  public provides: string[] = ["supply"];

  constructor(registry: [string, GeneratedType][]) {
    this.registry = registry;
  }

  async setup() {
    await this.pgIndexer.beginTransaction();
    const client = this.pgIndexer.getInstance();
    // Check if our table already exists and if not, create it
    const exists = await client.query(
      "SELECT EXISTS ( SELECT FROM pg_tables WHERE  schemaname = 'public' AND tablename  = 'supply_track')",
    );
    if (!exists.rows[0].exists) {
      this.indexer.log.warn("Database not configured");
      const base = fs.readFileSync(__dirname + "/./sql/module.sql").toString();
      try {
        await client.query(base);
        this.indexer.log.info("DB has been set up");
        await this.pgIndexer.endTransaction(true);
      }
      catch (e) {
        await this.pgIndexer.endTransaction(false);
        throw new Error("Error setting up db: " + e, {
          cause: e,
        });
      }
    }
    else {
      await this.pgIndexer.endTransaction(true);
    }
  }

  init(pgIndexer: PgIndexer): void {
    this.pgIndexer = pgIndexer;
    this.indexer = pgIndexer.indexer;

    // Create a map of the registry for easy access
    const registryMap: Map<string, (typeof this.registry)[0][1]> = new Map();
    for (let i = 0; i < this.registry.length; i++) {
      registryMap.set(this.registry[i][0], this.registry[i][1]);
    }
    this.indexer.log.verbose("Supply Module: Msg Registry mapped");
    // Register our event listener
    this.indexer.on("block", async (event) => {
      this.indexer.log.verbose("Indexing Supply");
      if (!event.height) {
        this.indexer.log.error("Event height is undefined");
        return;
      }
      const q = QueryTotalSupplyRequest.fromPartial({
      });
      const supply = QueryTotalSupplyRequest.encode(q).finish();
      const supplyq = await this.indexer.callABCI(
        "/cosmos.bank.v1beta1.Query/TotalSupply", supply, event.height,
        true,
      );
      const bal = QueryTotalSupplyResponse.decode(supplyq).supply;
      let atone = BigInt(0);
      let photon = BigInt(0);
      for (let i = 0; i < bal.length; i++) {
        if (bal[i].denom == "uatone") {
          atone = BigInt(bal[i].amount);
        }
        if (bal[i].denom == "uphoton") {
          photon = BigInt(bal[i].amount);
        }
      }
      await this.setSupply(atone, photon, event.height);
    });
    this.indexer.log.verbose("Supply Module: Listeners registered");
  }

  async setSupply(atone: bigint, photon: bigint, height: number) {
    const client = this.pgIndexer.getInstance();
    await client.query(
      "INSERT INTO supply_track (atone, photon, height) VALUES ($1, $2, $3);",
      [atone.toString(), photon.toString(), height.toString()],
    );
  }
}
