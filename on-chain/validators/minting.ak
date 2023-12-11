use aiken/transaction.{Output, OutputReference, ScriptContext, Transaction, Mint, TransactionId, Input, NoDatum}
use aiken/time.{PosixTime}
use aiken/interval.{Finite, Interval, IntervalBound}
use aiken/transaction/value
use aiken/list
use aiken/transaction/credential.{Address, ScriptCredential}


type Redeemer {
  MintNft
  BurnNft
}

validator(lock_time: PosixTime, utxo_ref: OutputReference) {
  fn minting_validator(redeemer: Redeemer, ctx: ScriptContext) -> Bool {
    expect is_not_expired(ctx.transaction, lock_time)

    expect Some(_input) = ctx.transaction.inputs
      |> list.find(fn(input) { input.output_reference == utxo_ref })

    expect Some((_, _, quantity)) = 
      ctx.transaction.mint
        |> value.from_minted_value
        |> value.flatten
        |> list.at(0) //Single NFT so far   

    when redeemer is {
      MintNft -> quantity == 1
      BurnNft -> quantity == -1
    }
  }
}

fn is_not_expired(tx: Transaction, lock_time: PosixTime) {
  when tx.validity_range.upper_bound.bound_type is {
    Finite(bound_time) -> bound_time <= lock_time
    _ -> False
  }
}


// ############### TESTS ###############

const mock_timestamp = 1704063599000 // 2023-12-31 23:59:59
const mock_owner = "some_fake_address_hash"
const mock_policy_id = "some_fake_policy_id"
const mock_asset_name = "some_fake_asset_name"

test should_mint_nft() {
  // GIVEN
  let redeemer = MintNft
  let output_ref = get_mock_output_reference("some_ref")
  let ctx = ScriptContext {
    purpose: Mint(mock_policy_id),
    transaction: get_mock_transaction(output_ref, 1704063500000, 1)
  }
  // THEN
  minting_validator(mock_timestamp, output_ref, redeemer, ctx) == True
}

test should_burn_nfg() {
  // GIVEN
  let redeemer = BurnNft
  let output_ref = get_mock_output_reference("some_ref")
  let ctx = ScriptContext {
    purpose: Mint(mock_policy_id),
    transaction: get_mock_transaction(output_ref, 1704063500000, -1)
  }
  // THEN
  minting_validator(mock_timestamp, output_ref, redeemer, ctx) == True
}

test should_failed_mint_by_wrong_asset_ammount() {
  // GIVEN
  let redeemer = MintNft
  let output_ref = get_mock_output_reference("some_ref")
  let ctx = ScriptContext {
    purpose: Mint(mock_policy_id),
    transaction: get_mock_transaction(output_ref, 1704063500000, 5)
  }
  // THEN
  minting_validator(mock_timestamp, output_ref, redeemer, ctx) == False
}

!test should_throw_error_by_exceeded_time_lock() {
  // GIVEN
  let redeemer = MintNft
  let output_ref = get_mock_output_reference("some_ref")
  let ctx = ScriptContext {
    purpose: Mint(mock_policy_id),
    transaction: get_mock_transaction(output_ref, mock_timestamp, 1)
  }
  // THEN
  minting_validator(1704063500000, output_ref, redeemer, ctx) == True
}

!test should_throw_error_by_wrong_reference() {
  // GIVEN
  let redeemer = MintNft
  let output_ref = get_mock_output_reference("some_ref")
  let other_ref = get_mock_output_reference("other_ref")
  let ctx = ScriptContext {
    purpose: Mint(mock_policy_id),
    transaction: get_mock_transaction(output_ref, 1704063500000, 1)
  }
  // THEN
  minting_validator(mock_timestamp, other_ref, redeemer, ctx) == True
}

fn get_mock_transaction(out_ref: OutputReference, to: Int, quantity: Int) {
  Transaction {
    ..transaction.placeholder(),
    extra_signatories: [mock_owner],
    mint: value.from_asset(mock_policy_id, mock_asset_name, quantity) |> value.to_minted_value,
    inputs: [ Input {
      output_reference: out_ref, 
      output: Output { 
        address: Address {
          payment_credential: ScriptCredential("mock_payment_address"),
          stake_credential: None,
        },
        datum: NoDatum,
        value: value.zero(),
        reference_script: None
      }
    }],
    validity_range: Interval { 
      lower_bound: IntervalBound { bound_type: Finite(1604063500000), is_inclusive: True }, 
      upper_bound: IntervalBound { bound_type: Finite(to), is_inclusive: True }
    }
  }
}

fn get_mock_output_reference(tx_hash: ByteArray) {
  OutputReference { 
    transaction_id: TransactionId {
      hash: tx_hash
    }, 
    output_index: 1
  }
}





