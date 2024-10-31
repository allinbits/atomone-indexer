import { runIndexer } from "@eclesia/indexer";

import { init, modules } from "./modules";

runIndexer(init, modules, __dirname + "/../genesis.json");
