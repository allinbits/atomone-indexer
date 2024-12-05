# Indexer modules

In order to create an indexing module, create a new folder with an `index.ts` file.

At the very minimum, this file should export a function that sets up your module and starts listeners for any events or msgs you want to index.

Obtaining a db client to run queries is as simple as `import { getInstance } from "../../db";` and `const db = getInstance();`

A standard process which can be seen in the already implemented modules is as follows:

- Include a `module.sql` file that contains the necessary SQL queries to set up tables/functions/etc userd by yoru module in the db.

- Inside the `index.ts` file create a `setupDB()` method that checks if `module.sql` has already been ran on the db (e.g. by checking for existence of a table) and if not, runs the sql file. e.g.

```
const setupDB = async () => {
  const db = getInstance();
  const exists = await db.query(
    "SELECT EXISTS ( SELECT FROM pg_tables WHERE  schemaname = 'public' AND tablename  = 'balances')",
  );
  if (!exists.rows[0].exists) {
    try {
      const module = fs.readFileSync(__dirname + "/module.sql").toString();
      await db.query(module);
    } catch (e) {
      throw new Error("Could not init module bank: " + e);
    }
  }
};
```

- Create an `init()` method that sets up the db and sets up listeners by listening to events on `bus` obtained by `import { bus } from "../../bus";`

- Standard events you can listen to are: `begin_block`, `end_block`, `tx_events`, `block` as well as individual messages by using the fully qualified message name: e.g. `/atomone.gov.v1beta1.MsgSubmitProposal`

- If listening for messages specific to this module that are not already handled, you have to create and export the appropriate Event for type-safety to work on the message bus e.g.:

```
export type Events = {
  "/atomone.gov.v1beta1.MsgSubmitProposal": { value: Uint8Array };
};
```

As you can see, in order to ensure the best possible performance, decoding the specific message is left to the module in question so it's only decoded if needed.

- By exporting the `init` function and `Events` type you can then import them to the `modules/index.ts` file and add them to the code appropriately.