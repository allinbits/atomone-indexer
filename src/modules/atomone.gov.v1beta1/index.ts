import * as fs from "node:fs";
import * as path from "node:path";
import {
  fileURLToPath,
} from "node:url";

import {
  Proposal as ProposalV1,
} from "@atomone/atomone-types/atomone/gov/v1/gov.js";
import {
  QueryProposalRequest as QueryProposalRequestV1,
  QueryProposalResponse as QueryProposalResponseV1,
} from "@atomone/atomone-types/atomone/gov/v1/query.js";
import {
  MsgDeposit as MsgDepositV1,
  MsgSubmitProposal as MsgSubmitProposalV1,
  MsgVote as MsgVoteV1,
  MsgVoteWeighted as MsgVoteWeightedV1,
} from "@atomone/atomone-types/atomone/gov/v1/tx.js";
import {
  Proposal,
  ProposalStatus,
  proposalStatusToJSON,
  TallyResult,
  TextProposal,
  voteOptionToJSON,
  WeightedVoteOption,
} from "@atomone/atomone-types/atomone/gov/v1beta1/gov.js";
import {
  QueryProposalRequest,
  QueryProposalResponse,
  QueryTallyResultRequest,
  QueryTallyResultResponse,
} from "@atomone/atomone-types/atomone/gov/v1beta1/query.js";
import {
  MsgDeposit,
  MsgSubmitProposal,
  MsgVote,
  MsgVoteWeighted,
} from "@atomone/atomone-types/atomone/gov/v1beta1/tx.js";
import {
  Coin,
} from "@atomone/atomone-types/cosmos/base/v1beta1/coin.js";
import {
  ParameterChangeProposal,
} from "@atomone/atomone-types/cosmos/params/v1beta1/params.js";
import {
  QueryPoolRequest,
  QueryPoolResponse,
} from "@atomone/atomone-types/cosmos/staking/v1beta1/query.js";
import {
  Pool,
} from "@atomone/atomone-types/cosmos/staking/v1beta1/staking.js";
import {
  SoftwareUpgradeProposal,
} from "@atomone/atomone-types/cosmos/upgrade/v1beta1/upgrade.js";
import {
  Any,
} from "@atomone/atomone-types/google/protobuf/any.js";
import {
  GeneratedType,
} from "@cosmjs/proto-signing";
import {
  fromSeconds, toRfc3339WithNanoseconds,
} from "@cosmjs/tendermint-rpc";
import {
  PgIndexer,
} from "@eclesia/basic-pg-indexer";
import {
  EcleciaIndexer, Types,
} from "@eclesia/indexer-engine";
import {
  Utils,
} from "@eclesia/indexer-engine";
import {
  JSONStringify,
} from "json-with-bigint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type Events = {
  "/atomone.gov.v1beta1.MsgSubmitProposal": {
    value: Types.TxResult<Uint8Array>
  }

  "/atomone.gov.v1.MsgSubmitProposal": {
    value: Types.TxResult<Uint8Array>
  }
  "/atomone.gov.v1beta1.MsgVote": {
    value: Types.TxResult<Uint8Array>
  }
  "/atomone.gov.v1beta1.MsgDeposit": {
    value: Types.TxResult<Uint8Array>
  }
  "/atomone.gov.v1beta1.MsgVoteWeighted": {
    value: Types.TxResult<Uint8Array>
  }
  "/atomone.gov.v1.MsgVote": {
    value: Types.TxResult<Uint8Array>
  }
  "/atomone.gov.v1.MsgDeposit": {
    value: Types.TxResult<Uint8Array>
  }
  "/atomone.gov.v1.MsgVoteWeighted": {
    value: Types.TxResult<Uint8Array>
  }
  "genesis/value/app_state.gov": {
    value: unknown
  }
};
export const getProposalContent = (
  content: Required<MsgSubmitProposal>["content"],
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
  }
  else {
    return content;
  }
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const consolidateEvents = (type: string, events: any[]) => {
  return {
    type,
    attributes: events
      .filter(x => x.type == type).map(x => x.attributes).flat(),
  };
};
export class GovModule implements Types.IndexingModule {
  indexer!: EcleciaIndexer;

  private pgIndexer!: PgIndexer;

  private registry: [string, GeneratedType][];

  public name: string = "atomone.gov.v1beta1";

  public depends: string[] = [];

  public provides: string[] = ["atomone.gov.v1beta1"];

  constructor(registry: [string, GeneratedType][]) {
    this.registry = registry;
  }

  async setup() {
    await this.pgIndexer.beginTransaction();
    const client = this.pgIndexer.getInstance();
    const exists = await client.query(
      "SELECT EXISTS ( SELECT FROM pg_tables WHERE  schemaname = 'public' AND tablename  = 'gov_params')",
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
        throw new Error("" + e);
      }
    }
    else {
      await this.pgIndexer.endTransaction(true);
    }
  }

  init(pgIndexer: PgIndexer): void {
    this.pgIndexer = pgIndexer;
    this.indexer = pgIndexer.indexer;
    const registryMap: Map<string, (typeof this.registry)[0][1]> = new Map();
    for (let i = 0; i < this.registry.length; i++) {
      registryMap.set(this.registry[i][0], this.registry[i][1]);
    }

    this.indexer.on("/atomone.gov.v1beta1.MsgSubmitProposal", async (event) => {
      this.indexer.log.verbose(
        "Value passed to gov indexing module: " + event.value,
      );
      const prop = MsgSubmitProposal.decode(event.value.tx);

      const content = prop.content
        ? getProposalContent(prop.content)
        : {
        };

      const submitProposalEvents = consolidateEvents("submit_proposal", event.value.events);
      const proposalId = submitProposalEvents.attributes.find(x => x.key == "proposal_id")?.value ?? 0;

      if (proposalId != 0) {
        const q = QueryProposalRequest.fromPartial({
          proposalId: BigInt(proposalId),
        });
        const propReq = QueryProposalRequest.encode(q).finish();
        const propResp = await this.indexer.callABCI(
          "/atomone.gov.v1beta1.Query/Proposal",
          propReq,
          event.height,
        );

        const proposal = QueryProposalResponse.decode(propResp).proposal;
        if (proposal) {
          await this.saveProposal(proposal, prop.proposer, content);
          await this.saveDeposit(
            proposal.proposalId,
            prop.proposer,
            prop.initialDeposit,
            event.timestamp ?? "",
            event.height,
          );
        }
        else {
          throw new Error("Could not fetch proposal. Are you connected to an archive node?");
        }
      }
      else {
        throw new Error("Invalid Proposal ID in event log:" + proposalId);
      }
    });

    this.indexer.on("/atomone.gov.v1.MsgSubmitProposal", async (event) => {
      this.indexer.log.verbose(
        "Value passed to gov indexing module: " + event.value,
      );
      const prop = MsgSubmitProposalV1.decode(event.value.tx);

      const content = prop.messages.length > 0
        ? JSONStringify(
          prop.messages.map((x) => {
            const msgtype = registryMap.get(x.typeUrl);
            if (msgtype) {
              const msg = msgtype?.decode(x.value);
              msg["@type"] = x.typeUrl;

              return msg;
            }
            else {
              return x;
            }
          }),
        )
        : "[]";

      const submitProposalEvents = consolidateEvents("submit_proposal", event.value.events);
      const proposalId = submitProposalEvents.attributes.find(x => x.key == "proposal_id")?.value ?? 0;

      if (proposalId != 0) {
        const q = QueryProposalRequestV1.fromPartial({
          proposalId: proposalId,
        });
        const propRes = QueryProposalRequestV1.encode(q).finish();
        const propq = await this.indexer.callABCI(
          "/atomone.gov.v1.Query/Proposal",
          propRes,
          event.height,
        );
        const proposal = QueryProposalResponseV1.decode(propq).proposal;

        if (proposal) {
          await this.saveProposalV1(proposal, proposal.proposer, content);
          await this.saveDeposit(
            proposal.id,
            proposal.proposer,
            prop.initialDeposit,
            event.timestamp ?? "",
            event.height,
          );
        }
        else {
          throw new Error("Could not fetch proposal. Are you connected to an archive node?");
        }
      }
      else {
        throw new Error("Invalid Proposal ID in event log:" + proposalId);
      }
    });
    this.indexer.on("/atomone.gov.v1beta1.MsgDeposit", async (event) => {
      this.indexer.log.verbose(
        "Value passed to gov indexing module: " + event.value,
      );
      const deposit = MsgDeposit.decode(event.value.tx);
      await this.saveDeposit(
        deposit.proposalId,
        deposit.depositor,
        deposit.amount,
        event.timestamp ?? "",
        event.height,
      );
      const proposalDepositEvents = consolidateEvents("proposal_deposit", event.value.events);
      if (proposalDepositEvents.attributes.find(x => x.key == "voting_period_start")?.value
        == deposit.proposalId.toString()
      ) {
        this.indexer.log.info("Updating proposal: " + deposit.proposalId);
        const q = QueryProposalRequestV1.fromPartial({
          proposalId: deposit.proposalId,
        });
        const prop = QueryProposalRequestV1.encode(q).finish();
        const propq = await this.indexer.callABCI(
          "/atomone.gov.v1.Query/Proposal",
          prop,
          event.height,
        );
        const proposal = QueryProposalResponseV1.decode(propq).proposal;
        if (proposal) {
          await this.updateProposal(proposal);
        }
        else {
          throw new Error("Could not fetch proposal. Are you connected to an archive node?");
        }
      }
    });

    this.indexer.on("/atomone.gov.v1.MsgDeposit", async (event) => {
      this.indexer.log.verbose(
        "Value passed to gov indexing module: " + event.value,
      );
      const deposit = MsgDepositV1.decode(event.value.tx);
      await this.saveDeposit(
        deposit.proposalId,
        deposit.depositor,
        deposit.amount,
        event.timestamp ?? "",
        event.height,
      );

      const proposalDepositEvents = consolidateEvents("proposal_deposit", event.value.events);
      if (proposalDepositEvents.attributes.find(x => x.key == "voting_period_start")?.value
        == deposit.proposalId.toString()
      ) {
        this.indexer.log.info("Updating proposal: " + deposit.proposalId);
        const q = QueryProposalRequestV1.fromPartial({
          proposalId: deposit.proposalId,
        });
        const prop = QueryProposalRequestV1.encode(q).finish();
        const propq = await this.indexer.callABCI(
          "/atomone.gov.v1.Query/Proposal",
          prop,
          event.height,
        );
        const proposal = QueryProposalResponseV1.decode(propq).proposal;
        if (proposal) {
          await this.updateProposal(proposal);
        }
        else {
          throw new Error("Could not fetch proposal. Are you connected to an archive node?");
        }
      }
    });
    this.indexer.on("/atomone.gov.v1beta1.MsgVote", async (event) => {
      this.indexer.log.verbose("Value passed to gov indexing module: " + event.value);
      const vote = MsgVote.decode(event.value.tx);
      await this.saveVotes(
        vote.proposalId,
        vote.voter,
        [
          {
            option: vote.option,
            weight: Math.pow(10, 18).toString(),
          },
        ],
        event.timestamp ?? "",
        event.height,
      );
    });

    this.indexer.on("/atomone.gov.v1.MsgVote", async (event) => {
      this.indexer.log.verbose("Value passed to gov indexing module: " + event.value);
      const vote = MsgVoteV1.decode(event.value.tx);
      await this.saveVotes(
        vote.proposalId,
        vote.voter,
        [
          {
            option: vote.option,
            weight: Math.pow(10, 18).toString(),
          },
        ],
        event.timestamp ?? "",
        event.height,
      );
    });
    this.indexer.on("/atomone.gov.v1beta1.MsgVoteWeighted", async (event) => {
      this.indexer.log.verbose("Value passed to gov indexing module: " + event.value);
      const vote = MsgVoteWeighted.decode(event.value.tx);
      await this.saveVotes(
        vote.proposalId,
        vote.voter,
        vote.options,
        event.timestamp ?? "",
        event.height,
      );
    });
    this.indexer.on("/atomone.gov.v1.MsgVoteWeighted", async (event) => {
      this.indexer.log.verbose("Value passed to gov indexing module: " + event.value);
      const vote = MsgVoteWeightedV1.decode(event.value.tx);
      await this.saveVotes(
        vote.proposalId,
        vote.voter,
        vote.options,
        event.timestamp ?? "",
        event.height,
      );
    });
    this.indexer.on("end_block", async (event) => {
      const events = event.value;
      const prop_events = events.filter(
        x => x.type == "active_proposal" || x.type == "inactive_proposal",
      );

      prop_events.forEach((x) => {
        const type = x.type;
        if (Utils.decodeAttr(x.attributes[0].key) == "proposal_id") {
          const proposalId = Utils.decodeAttr(x.attributes[0].value);
          if (Utils.decodeAttr(x.attributes[1].key) == "proposal_result") {
            const res = Utils.decodeAttr(x.attributes[1].value);
            if (type == "inactive_proposal" && res == "proposal_dropped") {
              this.deleteProposal(BigInt(proposalId));
            }
            if (type == "active_proposal" && res == "proposal_passed") {
              if (event.height) {
                this.updatePoolAndStatus(BigInt(proposalId), event.height);
              }
              this.updateProposalStatus(
                BigInt(proposalId),
                ProposalStatus.PROPOSAL_STATUS_PASSED,
              );
            }
            if (type == "active_proposal" && res == "proposal_rejected") {
              if (event.height) {
                this.updatePoolAndStatus(BigInt(proposalId), event.height);
              }
              this.updateProposalStatus(
                BigInt(proposalId),
                ProposalStatus.PROPOSAL_STATUS_REJECTED,
              );
            }
            if (type == "active_proposal" && res == "proposal_failed") {
              if (event.height) {
                this.updatePoolAndStatus(BigInt(proposalId), event.height);
              }
              this.updateProposalStatus(
                BigInt(proposalId),
                ProposalStatus.PROPOSAL_STATUS_FAILED,
              );
            }
          }
        }
      });
    });
    this.indexer.on("periodic/50", async (event) => {
      const db = this.pgIndexer.getInstance();
      const proposals = await db.query(
        "SELECT * FROM proposals WHERE voting_start_time<=$1 and voting_end_time>=$1 AND status='PROPOSAL_STATUS_VOTING_PERIOD'",
        [event.timestamp],
      );
      if (proposals.rows.length > 0) {
        for (let i = 0; i < proposals.rows.length; i++) {
          const q = QueryTallyResultRequest.fromPartial({
            proposalId: BigInt(proposals.rows[i].id),
          });
          const tally = QueryTallyResultRequest.encode(q).finish();
          const tallyq = await this.indexer.callABCI(
            "/atomone.gov.v1beta1.Query/TallyResult",
            tally,
            event.height,
          );

          const tallyresult = QueryTallyResultResponse.decode(tallyq).tally;
          if (tallyresult) {
            await this.saveTally(proposals.rows[i].id, tallyresult, event.height);
          }
        }
      }
    });
    this.indexer.on("genesis/value/app_state.gov", async (event) => {
      const db = this.pgIndexer.getInstance();
      await db.query("INSERT INTO gov_params(params) VALUES($1)", [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (event.value as any).params,
      ]);
    });
  }

  async saveProposal(
    prop: Proposal,
    proposer: string,
    content:
      | TextProposal
      | ParameterChangeProposal
      | SoftwareUpgradeProposal
      | {
        title?: string
        description?: string
      },
  ) {
    const db = this.pgIndexer.getInstance();
    await db.query(
      "INSERT INTO proposals(id,title,description,content,proposal_route,proposal_type,submit_time,deposit_end_time,voting_start_time,voting_end_time,proposer_address,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
      [
        prop.proposalId.toString(),
        content.title ?? "",
        content.description ?? "",
        content,
        "",
        prop.content?.typeUrl,
        fromSeconds(
          Number(prop.submitTime?.seconds ?? 0),
          prop.submitTime?.nanos ?? 0,
        ),
        fromSeconds(
          Number(prop.depositEndTime?.seconds ?? 0),
          prop.depositEndTime?.nanos ?? 0,
        ),
        fromSeconds(
          Number(prop.votingStartTime?.seconds ?? 0),
          prop.votingStartTime?.nanos ?? 0,
        ),
        fromSeconds(
          Number(prop.votingEndTime?.seconds ?? 0),
          prop.votingEndTime?.nanos ?? 0,
        ),
        proposer,
        proposalStatusToJSON(prop.status),
      ],
    );
  }

  async saveProposalV1(
    prop: ProposalV1,
    proposer: string,
    content: string,
  ) {
    const db = this.pgIndexer.getInstance();
    await db.query(
      "INSERT INTO proposals(id,title,description,content,proposal_route,proposal_type,submit_time,deposit_end_time,voting_start_time,voting_end_time,proposer_address,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
      [
        prop.id.toString(),
        prop.title ?? "",
        prop.summary ?? "",
        content,
        "",
        prop.messages[0]?.typeUrl ?? "",
        fromSeconds(
          Number(prop.submitTime?.seconds ?? 0),
          prop.submitTime?.nanos ?? 0,
        ),
        fromSeconds(
          Number(prop.depositEndTime?.seconds ?? 0),
          prop.depositEndTime?.nanos ?? 0,
        ),
        fromSeconds(
          Number(prop.votingStartTime?.seconds ?? 0),
          prop.votingStartTime?.nanos ?? 0,
        ),
        fromSeconds(
          Number(prop.votingEndTime?.seconds ?? 0),
          prop.votingEndTime?.nanos ?? 0,
        ),
        proposer,
        proposalStatusToJSON(prop.status),
      ],
    );
  }

  async updateProposal(prop: ProposalV1) {
    const db = this.pgIndexer.getInstance();

    await db.query(
      "UPDATE proposals SET deposit_end_time=$1,voting_start_time=$2,voting_end_time=$3,status=$4 WHERE id=$5",
      [
        toRfc3339WithNanoseconds(
          fromSeconds(
            Number(prop.depositEndTime?.seconds ?? 0),
            prop.depositEndTime?.nanos ?? 0,
          ),
        ),
        toRfc3339WithNanoseconds(
          fromSeconds(
            Number(prop.votingStartTime?.seconds ?? 0),
            prop.votingStartTime?.nanos ?? 0,
          ),
        ),
        toRfc3339WithNanoseconds(
          fromSeconds(
            Number(prop.votingEndTime?.seconds ?? 0),
            prop.votingEndTime?.nanos ?? 0,
          ),
        ),
        proposalStatusToJSON(prop.status),
        prop.id.toString(),
      ],
    );
  }

  async updateProposalStatus(
    proposalId: bigint,
    status: ProposalStatus,
  ) {
    const db = this.pgIndexer.getInstance();

    await db.query("UPDATE proposals SET status=$1 WHERE id=$2", [proposalStatusToJSON(status), proposalId.toString()]);
  }

  async deleteProposal(proposalId: bigint) {
    const db = this.pgIndexer.getInstance();

    await db.query("DELETE FROM proposal_tally_results WHERE proposal_id=$1", [proposalId.toString()]);
    await db.query("DELETE FROM proposal_deposits WHERE proposal_id=$1", [proposalId.toString()]);
    await db.query("DELETE FROM proposal_votes WHERE proposal_id=$1", [proposalId.toString()]);
    await db.query("DELETE FROM proposals WHERE id=$1", [proposalId.toString()]);
  }

  async updatePoolAndStatus(proposalId: bigint, height: number) {
    const q = QueryPoolRequest.fromPartial({
    });
    const poolreq = QueryPoolRequest.encode(q).finish();

    this.indexer.callABCI("/cosmos.staking.v1beta1.Query/Pool", poolreq, height).then(
      async (poolq) => {
        const pool = QueryPoolResponse.decode(poolq).pool;
        if (pool) {
          await this.savePoolSnapshot(proposalId, pool, height);
        }
      },
    );
  }

  async savePoolSnapshot(
    proposalId: bigint,
    pool: Pool,
    height: number,
  ) {
    const db = this.pgIndexer.getInstance();
    await db.query(
      "INSERT INTO proposal_staking_pool_snapshots(proposal_id, bonded_tokens,not_bonded_tokens,height) VALUES($1,$2,$3,$4 )",
      [proposalId.toString(), pool.bondedTokens, pool.notBondedTokens, height],
    );
  }

  async saveDeposit(
    proposalId: bigint,
    depositorAddress: string,
    amount: Coin[],
    timestamp: string,
    height?: number,
  ) {
    const db = this.pgIndexer.getInstance();
    await db.query(
      "INSERT INTO proposal_deposits( proposal_id,depositor_address,amount,timestamp,height) VALUES($1,$2,$3::COIN[],$4,$5)",
      [
        proposalId.toString(),
        depositorAddress,
        amount.map((x) => {
          return "(\"" + x.denom + "\", \"" + x.amount + "\")";
        }),
        timestamp,
        height,
      ],
    );
  }

  async saveVotes(
    proposalId: bigint,
    voter: string,
    options: WeightedVoteOption[],
    timestamp: string,
    height?: number,
  ) {
    const db = this.pgIndexer.getInstance();

    await db.query(
      "UPDATE proposal_votes SET is_valid=false WHERE voter_address=$1 AND proposal_id=$2",
      [voter, proposalId.toString()],
    );
    for (let i = 0; i < options.length; i++) {
      await this.saveVote(proposalId, voter, options[i], timestamp, height);
    }
  }

  async saveVote(
    proposalId: bigint,
    voter: string,
    option: WeightedVoteOption,
    timestamp: string,
    height?: number,
  ) {
    const db = this.pgIndexer.getInstance();

    await db.query(
      "INSERT INTO proposal_votes(proposal_id,voter_address,is_valid,option,weight,timestamp,height) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [proposalId.toString(), voter, true, voteOptionToJSON(option.option), parseInt(option.weight) / Math.pow(10, 18), timestamp, height],
    );
  }

  async saveTally(
    proposalId: string,
    tally: TallyResult,
    height?: number,
  ) {
    const db = this.pgIndexer.getInstance();

    await db.query(
      "INSERT INTO proposal_tally_results(proposal_id,yes,abstain,no,no_with_veto,height) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT ON CONSTRAINT unique_tally DO NOTHING",
      [proposalId.toString(), tally.yes, tally.abstain, tally.no, tally.noWithVeto, height],
    );
  }
}
