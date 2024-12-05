/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-lines-per-function */
import fs from "node:fs";
import path from "node:path";

import {
  ProposalStatus,
  TextProposal,
} from "@atomone/atomone-types/atomone/gov/v1beta1/gov";
import {
  QueryProposalRequest,
  QueryProposalResponse,
  QueryTallyResultRequest,
  QueryTallyResultResponse,
} from "@atomone/atomone-types/atomone/gov/v1beta1/query";
import {
  MsgDeposit,
  MsgSubmitProposal,
  MsgVote,
  MsgVoteWeighted,
} from "@atomone/atomone-types/atomone/gov/v1beta1/tx";
import { ParameterChangeProposal } from "@atomone/atomone-types/cosmos/params/v1beta1/params";
import { SoftwareUpgradeProposal } from "@atomone/atomone-types/cosmos/upgrade/v1beta1/upgrade";
import { Any } from "@atomone/atomone-types/google/protobuf/any";
import { bus, DB, log, Types, Utils } from "@eclesia/indexer";

import {
  deleteProposal,
  saveDeposit,
  saveProposal,
  saveTally,
  saveVotes,
  updatePoolAndStatus,
  updateProposal,
  updateProposalStatus,
} from "./queries";

export type Events = {
  "/atomone.gov.v1beta1.MsgSubmitProposal": {
    value: Types.TxResult<Uint8Array>;
  };
  "/atomone.gov.v1beta1.MsgVote": { value: Types.TxResult<Uint8Array> };
  "/atomone.gov.v1beta1.MsgDeposit": { value: Types.TxResult<Uint8Array> };
  "/atomone.gov.v1beta1.MsgVoteWeighted": { value: Types.TxResult<Uint8Array> };
  "genesis/value/app_state.gov": { value: unknown };
};
export const getProposalContent = (
  content: Required<MsgSubmitProposal>["content"]
): TextProposal | ParameterChangeProposal | SoftwareUpgradeProposal | Any => {
  if ((content as Any).typeUrl) {
    switch ((content as Any).typeUrl) {
      case "/cosmos.params.v1beta1.ParameterChangeProposal":
        return ParameterChangeProposal.decode((content as Any).value);
      case "/cosmos.upgrade.v1beta1.SoftwareUpgradeProposal":
        return SoftwareUpgradeProposal.decode((content as Any).value);
      case "/atomone.gov.v1beta1.TextProposal":
      default:
        return TextProposal.decode((content as Any).value);
    }
  } else {
    return content;
  }
};

const migrate = async () => {
  const client = await DB.getInstance();
  try {
    const latestMigrationQuery = await client.query(
      "SELECT * FROM migrations WHERE module=$1 ORDER BY dt DESC LIMIT 1",
      [name]
    );
    if (fs.existsSync(__dirname + "/migrations")) {
      const latestMigration =
        latestMigrationQuery.rowCount && latestMigrationQuery.rowCount > 0
          ? latestMigrationQuery.rows[0].dt
          : "0";
      const files = fs.readdirSync(__dirname + "/migrations").sort();
      for (let i = 0; i < files.length; i++) {
        if (path.extname(files[i]) == ".js") {
          const dt = path.basename(files[i], ".js");
          if (Number(dt) > Number(latestMigration)) {
            const migrationPath = __dirname + "/migrations/" + files[i];
            const migration = await import(migrationPath);
            log.info("Running migration: (" + name + ") " + migrationPath);
            await migration.run(client);
            await client.query(
              "INSERT INTO migrations(module,dt) VALUES ($1,$2);",
              [name, dt]
            );
          }
        }
      }
    }
  } catch (e) {
    log.error("" + e);
    throw e;
  }
};
const setupDB = async () => {
  const db = DB.getInstance();
  const exists = await db.query(
    "SELECT EXISTS ( SELECT FROM pg_tables WHERE  schemaname = 'public' AND tablename  = 'proposal')"
  );
  if (!exists.rows[0].exists) {
    try {
      const module = fs.readFileSync(__dirname + "/module.sql").toString();
      await db.query(module);
    } catch (e) {
      throw new Error("Could not init module govgen: " + e);
    }
  }
  try {
    await migrate();
  } catch (_e) {
    throw new Error("Could not migrate module: " + name);
  }
};
export const init = async () => {
  await setupDB();
  bus.on("/atomone.gov.v1beta1.MsgSubmitProposal", async (event) => {
    try {
      log.verbose(
        "Value passed to gov indexing module: " + (event as any).value
      );
      const prop = MsgSubmitProposal.decode(event.value.tx);

      const content = prop.content ? getProposalContent(prop.content) : {};

      const proposalId =
        event.value.events
          .find((x) => x.type == "submit_proposal")
          ?.attributes.find((x) => x.key == "proposal_id")?.value ?? 0;
      if (proposalId != 0) {
        const q = QueryProposalRequest.fromPartial({
          proposalId: BigInt(proposalId),
        });
        const propReq = QueryProposalRequest.encode(q).finish();
        const propResp = await Utils.callABCI(
          "/atomone.gov.v1beta1.Query/Proposal",
          propReq,
          event.height
        );

        const proposal = QueryProposalResponse.decode(propResp).proposal;
        if (proposal) {
          await saveProposal(proposal, prop.proposer, content);
          await saveDeposit(
            proposal.proposalId,
            prop.proposer,
            prop.initialDeposit,
            event.timestamp ?? "",
            event.height
          );
        }
      }

      if (event.uuid) {
        bus.emit("uuid", { status: true, uuid: event.uuid });
      }
    } catch (_e) {
      if (event.uuid) {
        bus.emit("uuid", { status: false, uuid: event.uuid });
      }
    }
  });

  bus.on("/atomone.gov.v1beta1.MsgDeposit", async (event) => {
    try {
      log.verbose(
        "Value passed to gov indexing module: " + (event as any).value
      );
      const deposit = MsgDeposit.decode(event.value.tx);
      await saveDeposit(
        deposit.proposalId,
        deposit.depositor,
        deposit.amount,
        event.timestamp ?? "",
        event.height
      );

      if (
        event.value.events
          .find((x) => x.type == "proposal_deposit")
          ?.attributes.find((x) => x.key == "voting_period_start")?.value ==
        deposit.proposalId.toString()
      ) {
        log.log("Updating proposal: " + deposit.proposalId);
        const q = QueryProposalRequest.fromPartial({
          proposalId: deposit.proposalId,
        });
        const prop = QueryProposalRequest.encode(q).finish();
        const propq = await Utils.callABCI(
          "/atomone.gov.v1beta1.Query/Proposal",
          prop,
          event.height
        );
        const proposal = QueryProposalResponse.decode(propq).proposal;
        if (proposal) {
          await updateProposal(proposal);
        }
      }
      if (event.uuid) {
        bus.emit("uuid", { status: true, uuid: event.uuid });
      }
    } catch (_e) {
      if (event.uuid) {
        bus.emit("uuid", { status: false, uuid: event.uuid });
      }
    }
  });

  bus.on("/atomone.gov.v1beta1.MsgVote", async (event) => {
    log.verbose("Value passed to gov indexing module: " + (event as any).value);
    const vote = MsgVote.decode(event.value.tx);
    await saveVotes(
      vote.proposalId,
      vote.voter,
      [{ option: vote.option, weight: Math.pow(10, 18).toString() }],
      event.timestamp ?? "",
      event.height
    );
    if (event.uuid) {
      bus.emit("uuid", { status: true, uuid: event.uuid });
    }
  });

  bus.on("/atomone.gov.v1beta1.MsgVoteWeighted", async (event) => {
    log.verbose("Value passed to gov indexing module: " + (event as any).value);
    const vote = MsgVoteWeighted.decode(event.value.tx);
    await saveVotes(
      vote.proposalId,
      vote.voter,
      vote.options,
      event.timestamp ?? "",
      event.height
    );
    if (event.uuid) {
      bus.emit("uuid", { status: true, uuid: event.uuid });
    }
  });
  bus.on("end_block", async (event) => {
    const events = event.value;
    const prop_events = events.filter(
      (x) => x.type == "active_proposal" || x.type == "inactive_proposal"
    );
    prop_events.forEach((x) => {
      const type = x.type;
      if (Utils.decodeAttr(x.attributes[0].key) == "proposal_id") {
        const proposalId = Utils.decodeAttr(x.attributes[0].value);
        if (Utils.decodeAttr(x.attributes[1].key) == "proposal_result") {
          const res = Utils.decodeAttr(x.attributes[1].value);
          if (type == "inactive_proposal" && res == "proposal_dropped") {
            deleteProposal(BigInt(proposalId));
          }
          if (type == "active_proposal" && res == "proposal_passed") {
            if (event.height) {
              updatePoolAndStatus(BigInt(proposalId), event.height);
            }
            updateProposalStatus(
              BigInt(proposalId),
              ProposalStatus.PROPOSAL_STATUS_PASSED
            );
          }
          if (type == "active_proposal" && res == "proposal_rejected") {
            if (event.height) {
              updatePoolAndStatus(BigInt(proposalId), event.height);
            }
            updateProposalStatus(
              BigInt(proposalId),
              ProposalStatus.PROPOSAL_STATUS_REJECTED
            );
          }
          if (type == "active_proposal" && res == "proposal_failed") {
            if (event.height) {
              updatePoolAndStatus(BigInt(proposalId), event.height);
            }
            updateProposalStatus(
              BigInt(proposalId),
              ProposalStatus.PROPOSAL_STATUS_FAILED
            );
          }
        }
      }
    });
    if (event.uuid) {
      bus.emit("uuid", { status: true, uuid: event.uuid });
    }
  });
  bus.on("periodic/50", async (event) => {
    try {
      const db = DB.getInstance();
      const proposals = await db.query(
        "SELECT * FROM proposal WHERE voting_start_time<=$1 and voting_end_time>=$1 AND status='PROPOSAL_STATUS_VOTING_PERIOD'",
        [event.timestamp]
      );
      if (proposals.rows.length > 0) {
        for (let i = 0; i < proposals.rows.length; i++) {
          const q = QueryTallyResultRequest.fromPartial({
            proposalId: BigInt(proposals.rows[i].id),
          });
          const tally = QueryTallyResultRequest.encode(q).finish();
          const tallyq = await Utils.callABCI(
            "/atomone.gov.v1beta1.Query/TallyResult",
            tally,
            event.height
          );

          const tallyresult = QueryTallyResultResponse.decode(tallyq).tally;
          if (tallyresult) {
            await saveTally(proposals.rows[i].id, tallyresult, event.height);
          }
        }
      }
      if (event.uuid) {
        bus.emit("uuid", { status: true, uuid: event.uuid });
      }
    } catch (_e) {
      if (event.uuid) {
        bus.emit("uuid", { status: false, uuid: event.uuid });
      }
    }
  });
  bus.on("genesis/value/app_state.gov", async (event) => {
    const db = DB.getInstance();
    await db.query("INSERT INTO gov_params(params) VALUES($1)", [
      (event.value as any).params,
    ]);
    if (event.uuid) {
      bus.emit("uuid", { status: true, uuid: event.uuid });
    }
  });

  /*
     Load module information
     Check for module dependencies
     Set up db tables if not exist from module.sql
     Register event listeners:
        - New block
        - Begin block events
        - End block events
        - Specific msg types
    */
};

export const depends = ["cosmos.auth.v1beta1", "cosmos.staking.v1beta1"];
export const name = "atomone.gov.v1beta1";
export const provides = [name, "cosmos.gov.v1beta1"];
