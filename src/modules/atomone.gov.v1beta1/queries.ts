import {
  Proposal as ProposalV1
} from "@atomone/atomone-types/atomone/gov/v1/gov";
import {
  Proposal,
  ProposalStatus,
  proposalStatusToJSON,
  TallyResult,
  TextProposal,
  voteOptionToJSON,
  WeightedVoteOption,
} from "@atomone/atomone-types/atomone/gov/v1beta1/gov";
import { Coin } from "@atomone/atomone-types/cosmos/base/v1beta1/coin";
import { ParameterChangeProposal } from "@atomone/atomone-types/cosmos/params/v1beta1/params";
import {
  QueryPoolRequest,
  QueryPoolResponse,
} from "@atomone/atomone-types/cosmos/staking/v1beta1/query";
import { Pool } from "@atomone/atomone-types/cosmos/staking/v1beta1/staking";
import { SoftwareUpgradeProposal } from "@atomone/atomone-types/cosmos/upgrade/v1beta1/upgrade";
import { fromSeconds, toRfc3339WithNanoseconds } from "@cosmjs/tendermint-rpc";
import { DB, Utils } from "@eclesia/indexer";

const saveProposal = async (
  prop: Proposal,
  proposer: string,
  content:
    | TextProposal
    | ParameterChangeProposal
    | SoftwareUpgradeProposal
    | { title?: string; description?: string }
) => {
  const db = DB.getInstance();  
  await db.query(
    "INSERT INTO proposal(id,title,description,content,proposal_route,proposal_type,submit_time,deposit_end_time,voting_start_time,voting_end_time,proposer_address,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
    [
      prop.proposalId.toString(),
      content.title ?? "",
      content.description ?? "",
      content,
      "",
      prop.content?.typeUrl,
      fromSeconds(
        Number(prop.submitTime?.seconds ?? 0),
        prop.submitTime?.nanos ?? 0
      ),
      fromSeconds(
        Number(prop.depositEndTime?.seconds ?? 0),
        prop.depositEndTime?.nanos ?? 0
      ),
      fromSeconds(
        Number(prop.votingStartTime?.seconds ?? 0),
        prop.votingStartTime?.nanos ?? 0
      ),
      fromSeconds(
        Number(prop.votingEndTime?.seconds ?? 0),
        prop.votingEndTime?.nanos ?? 0
      ),
      proposer,
      proposalStatusToJSON(prop.status),
    ]
  );

};
const saveProposalV1 = async (
  prop: ProposalV1,
  proposer: string,
  content: string
) => {
  const db = DB.getInstance();  
  await db.query(
    "INSERT INTO proposal(id,title,description,content,proposal_route,proposal_type,submit_time,deposit_end_time,voting_start_time,voting_end_time,proposer_address,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
    [
      prop.id.toString(),
      prop.title ?? "",
      prop.summary ?? "",
      content,
      "",
      prop.messages[0]?.typeUrl ?? "",
      fromSeconds(
        Number(prop.submitTime?.seconds ?? 0),
        prop.submitTime?.nanos ?? 0
      ),
      fromSeconds(
        Number(prop.depositEndTime?.seconds ?? 0),
        prop.depositEndTime?.nanos ?? 0
      ),
      fromSeconds(
        Number(prop.votingStartTime?.seconds ?? 0),
        prop.votingStartTime?.nanos ?? 0
      ),
      fromSeconds(
        Number(prop.votingEndTime?.seconds ?? 0),
        prop.votingEndTime?.nanos ?? 0
      ),
      proposer,
      proposalStatusToJSON(prop.status),
    ]
  );
};
const updateProposal = async (prop: ProposalV1) => {
  const db = DB.getInstance();

  await db.query(
    "UPDATE proposal SET deposit_end_time=$1,voting_start_time=$2,voting_end_time=$3,status=$4 WHERE id=$5",
    [
      toRfc3339WithNanoseconds(
        fromSeconds(
          Number(prop.depositEndTime?.seconds ?? 0),
          prop.depositEndTime?.nanos ?? 0
        )
      ),
      toRfc3339WithNanoseconds(
        fromSeconds(
          Number(prop.votingStartTime?.seconds ?? 0),
          prop.votingStartTime?.nanos ?? 0
        )
      ),
      toRfc3339WithNanoseconds(
        fromSeconds(
          Number(prop.votingEndTime?.seconds ?? 0),
          prop.votingEndTime?.nanos ?? 0
        )
      ),
      proposalStatusToJSON(prop.status),
      prop.id.toString(),
    ]
  );
};
const updateProposalStatus = async (
  proposalId: bigint,
  status: ProposalStatus
) => {
  const db = DB.getInstance();

  await db.query("UPDATE proposal SET status=$1 WHERE id=$2", [
    proposalStatusToJSON(status),
    proposalId.toString(),
  ]);
};
const deleteProposal = async (proposalId: bigint) => {
  const db = DB.getInstance();

  await db.query("DELETE FROM proposal_tally_result WHERE proposal_id=$1", [
    proposalId.toString(),
  ]);
  await db.query("DELETE FROM proposal_deposit WHERE proposal_id=$1", [
    proposalId.toString(),
  ]);
  await db.query("DELETE FROM proposal_vote WHERE proposal_id=$1", [
    proposalId.toString(),
  ]);
  await db.query("DELETE FROM proposal WHERE id=$1", [proposalId.toString()]);
};
const updatePoolAndStatus = async (proposalId: bigint, height: number) => {
  const q = QueryPoolRequest.fromPartial({});
  const poolreq = QueryPoolRequest.encode(q).finish();

  Utils.callABCI("/cosmos.staking.v1beta1.Query/Pool", poolreq, height).then(
    async (poolq) => {
      const pool = QueryPoolResponse.decode(poolq).pool;
      if (pool) {
        await savePoolSnapshot(proposalId, pool, height);
      }
    }
  );
};
const savePoolSnapshot = async (
  proposalId: bigint,
  pool: Pool,
  height: number
) => {
  const db = DB.getInstance();
  await db.query(
    "INSERT INTO proposal_staking_pool_snapshot(proposal_id, bonded_tokens,not_bonded_tokens,height) VALUES($1,$2,$3,$4 )",
    [proposalId.toString(), pool.bondedTokens, pool.notBondedTokens, height]
  );
};
const saveDeposit = async (
  proposalId: bigint,
  depositorAddress: string,
  amount: Coin[],
  timestamp: string,
  height?: number
) => {
  const db = DB.getInstance();
  await db.query(
    "INSERT INTO proposal_deposit( proposal_id,depositor_address,amount,timestamp,height) VALUES($1,$2,$3::COIN[],$4,$5)",
    [
      proposalId.toString(),
      depositorAddress,
      amount.map((x) => {
        return '("' + x.denom + '", "' + x.amount + '")';
      }),
      timestamp,
      height,
    ]
  );
};
const saveVotes = async (
  proposalId: bigint,
  voter: string,
  options: WeightedVoteOption[],
  timestamp: string,
  height?: number
) => {
  const db = DB.getInstance();

  await db.query(
    "UPDATE proposal_vote SET is_valid=false WHERE voter_address=$1 AND proposal_id=$2",
    [voter, proposalId.toString()]
  );
  for (let i = 0; i < options.length; i++) {
    await saveVote(proposalId, voter, options[i], timestamp, height);
  }
};
const saveVote = async (
  proposalId: bigint,
  voter: string,
  option: WeightedVoteOption,
  timestamp: string,
  height?: number
) => {
  const db = DB.getInstance();

  await db.query(
    "INSERT INTO proposal_vote(proposal_id,voter_address,is_valid,option,weight,timestamp,height) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [
      proposalId.toString(),
      voter,
      true,
      voteOptionToJSON(option.option),
      parseInt(option.weight) / Math.pow(10, 18),
      timestamp,
      height,
    ]
  );
};
const saveTally = async (
  proposalId: string,
  tally: TallyResult,
  height?: number
) => {
  const db = DB.getInstance();

  await db.query(
    "INSERT INTO proposal_tally_result(proposal_id,yes,abstain,no,no_with_veto,height) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT ON CONSTRAINT unique_tally DO NOTHING",
    [
      proposalId.toString(),
      tally.yes,
      tally.abstain,
      tally.no,
      tally.noWithVeto,
      height,
    ]
  );
};
export {
  deleteProposal,
  saveDeposit,
  savePoolSnapshot,
  saveProposal,
  saveProposalV1,
  saveTally,
  saveVote,
  saveVotes,
  updatePoolAndStatus,
  updateProposal,
  updateProposalStatus,
};
