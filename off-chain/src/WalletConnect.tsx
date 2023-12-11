import { Blockfrost, Constr, Data, Lucid, Network, Script, applyParamsToScript, fromText } from "lucid-cardano"
import { useState } from "react"

type TokenData = {
  tokenName: string,
  name: string,
  image: string,
  description: string,
}

const inputClass = {
  width: '100%'
} as const;


const MINTING_CONTRACT_HASH = `
  59026001000032323232323232323223222232533300932533300a33223232533300e3370e9001000899b89375
  a602660180040062940c030004c00cc028c044c048c028c044c048c048c048c048c048c048c048c028008c004c
  02000c0184c94ccc02ccdc3a4000601400226464a66601a66e1d2000300c001132323232323253330133370e90
  00000899b87002480084cdc38012400260220186eb4c058004c058004c054004dd6180980098058008b1919191
  9991800800911299980a8010a60103d87a80001323253330143370e0069000099ba548000cc060dd380125eb80
  4ccc014014004cdc0801a400460320066eb0c05c0080052000323300100100222533301300114bd70099199911
  191980080080191299980c80088018991999111980f1ba73301e37520126603c6ea400ccc078dd400125eb8000
  4dd7180c0009bad301900133003003301d002301b001375c60240026eacc04c004cc00c00cc05c008c054004c8
  cc004004008894ccc04800452f5bded8c0264646464a66602666e3d221000021003133017337606ea4008dd300
  0998030030019bab3014003375c6024004602c00460280026eacc044c048c048c048c048c028c00cc028014c02
  400458c8c8cc004004008894ccc0400045300103d87a800013232533300f3375e600c601a004014266e9520003
  30130024bd70099802002000980a00118090009bac3001300830013008003162300f00114984d958c94ccc024c
  dc3a40000022a666018600e0062930b0a99980499b874800800454ccc030c01c00c52616163007002375a00246
  00a6ea80048c00cdd5000ab9a5573aaae7955cfaba05742ae881`.replace(/\n|\r|\W/g, '').trim();


const BLOCKFROST_URL = 'https://cardano-preprod.blockfrost.io/api/v0'
const BLOCKFROST_TOKEN = 'your_token_here'
const BLOCKFROST_ENV = 'Preprod'
const THRESHOLD_DATE = '2023-12-31 23:58:59'


export const WalletConnect = () => {
  const [lucid, setLucid] = useState<Lucid | undefined>()
  const [tokenData, setTokenData] = useState<TokenData | undefined>()

  const connectWallet = async () => {
    const blockfrost = new Blockfrost(BLOCKFROST_URL, BLOCKFROST_TOKEN)
    const lucid = await Lucid.new(blockfrost, BLOCKFROST_ENV as Network);
    const api = await window.cardano.nami.enable();
    lucid.selectWallet(api);
    setLucid(lucid)
  }

  const onSubmit = async () => {
    const limit = new Date(THRESHOLD_DATE).getTime()
    const validTo = new Date();
    validTo.setHours(validTo.getHours() + 1);

    const utxos = await lucid!.wallet.getUtxos();
    const outRef = new Constr(0, [
      new Constr(0, [utxos[0].txHash]),
      BigInt(utxos[0].outputIndex),
    ]);
    const policy: Script = {
      type: "PlutusV2",
      script: applyParamsToScript(MINTING_CONTRACT_HASH, [BigInt(limit), outRef]),
    }
    const policyId = lucid!.utils.mintingPolicyToId(policy);
    const onchainAssetName = policyId + fromText(tokenData!.tokenName);

    const transaction = await lucid!
      .newTx()
      .collectFrom(utxos)
      .attachMintingPolicy(policy)
      .mintAssets(
        { [onchainAssetName]: BigInt(1) },
        Data.to(new Constr(0, [])) // Constr(1, []) to Burn
      )
      .validTo(validTo.getTime())
      .attachMetadata(721, {
        [policyId]: {
          [tokenData!.tokenName]: {
            "id": 1,
            "name": tokenData!.name,
            "description": tokenData!.description,
            "image": tokenData!.image
          }
        }
      })
      .complete()

    const txSigned = await transaction.sign().complete();
    const txHash = await txSigned.submit();

    console.log('txHash: ', txHash);
  }

  const handleTokenDataInput = (field: string, event: any) => {
    const newValue = { ...tokenData, [field]: event.target.value } as TokenData
    setTokenData(newValue)
  }

  return (
    <div style={{ marginLeft: 20, marginTop: 20 }}>
      <div>
        <button onClick={connectWallet}>
          {lucid ? 'connected' : 'connect wallet'}
        </button>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `100px 500px`,
        gridTemplateRows: `25px 25px 25px 25px`,
        marginTop: 15,
        marginBottom: 20,
        gap: 10
      }}>
        <div>TokenName: </div>
        <div>
          <input
            style={inputClass}
            placeholder="SomeName"
            onChange={(event) => handleTokenDataInput('tokenName', event)}
          />
        </div>
        <div>Name: </div>
        <div>
          <input
            style={inputClass}
            placeholder="Some Name"
            onChange={(event) => handleTokenDataInput('name', event)}
          />
        </div>
        <div>Description: </div>
        <div>
          <input
            style={inputClass}
            placeholder="Some Description"
            onChange={(event) => handleTokenDataInput('description', event)}
          />
        </div>
        <div>Image: </div>
        <div>
          <input
            style={inputClass}
            placeholder="ipfs://AAAAAAAAAABBBBBBBBBBCCCCCCCCCCDDDDDDDDDD123456"
            onChange={(event) => handleTokenDataInput('image', event)}
          />
        </div>
      </div>
      <div>
        <button onClick={onSubmit}>Submit</button>
      </div>
    </div>
  )
}