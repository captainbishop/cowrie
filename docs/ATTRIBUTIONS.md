# External code, libraries and services

Cowrie's project code is released under the [MIT license](../LICENSE). External dependencies, generated code and assets retain their upstream licenses and notices. The project's MIT license does not relicense them.

## Project code and reused foundations

Cowrie's application logic lives in the [wallet UI](../web/app/CowrieApp.tsx), [intent API](../web/app/api/parse/route.ts), [bill flow engine](../web/lib/bills.ts), [Ajo intent layer](../web/lib/ajoIntent.ts), [Solidity contracts](../contracts/) and [Ajo CRE workflow](../cowrie-cre/my-workflow/workflow.ts). These connect the conversational wallet, financial rules, demo DeFi features and savings-circle lifecycle.

The CRE project started from the [SmartContract CRE templates](https://github.com/smartcontractkit/cre-templates), distributed under [MIT](https://github.com/smartcontractkit/cre-templates/blob/main/LICENSE). Its initial feed-reading scaffold was adapted into the Ajo workflow. The template's copyright and license notice is preserved below.

The files under [cowrie-cre/contracts/evm/ts/generated/](../cowrie-cre/contracts/evm/ts/generated/) are generated CRE bindings, not hand-written Cowrie implementations. The Ajo bindings describe this repository's contracts; the [price-feed ABI](../cowrie-cre/contracts/evm/src/abi/PriceFeedAggregator.abi) describes Chainlink's aggregator interface. The [CRE SDK and tooling](https://github.com/smartcontractkit/cre-sdk-typescript) provide the runtime and binding infrastructure.

OpenZeppelin supplies the ERC-20, ownership, safe-transfer and reentrancy utilities imported by Cowrie's Solidity contracts. Those imports remain references to the upstream package installed with npm.

## Libraries

| Package | Upstream project / authors | Used for | License |
|---|---|---|---|
| `@openzeppelin/contracts` | [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts) | Token interfaces, ERC-20 implementation and contract utilities | MIT |
| `hardhat`, `@nomicfoundation/hardhat-toolbox` | [Nomic Foundation](https://github.com/NomicFoundation/hardhat) | Compilation, deployment and contract tests | MIT |
| `ethers` | [ethers.js contributors](https://github.com/ethers-io/ethers.js) | Wallet and contract operations in scripts and tests; supplied through the Hardhat toolchain | MIT |
| `dotenv` | [dotenv contributors](https://github.com/motdotla/dotenv) | Root deployment environment loading | BSD-2-Clause |
| `next` | [Vercel and Next.js contributors](https://github.com/vercel/next.js) | Web application and server API routes | MIT |
| `react`, `react-dom` | [React contributors](https://github.com/facebook/react) | UI components and state | MIT |
| `@privy-io/react-auth` | [Privy](https://docs.privy.io/) | Login, embedded wallets and transaction requests | Apache-2.0 |
| `@privy-io/node` | [Privy Node SDK](https://github.com/privy-io/node-sdk) | Server-side access-token verification for contact storage | Apache-2.0 |
| `viem` | [wevm](https://github.com/wevm/viem) | EVM clients, ABI encoding, contract reads and transaction handling | MIT |
| `@chainlink/cre-sdk` | [SmartContract / Chainlink](https://github.com/smartcontractkit/cre-sdk-typescript) | CRE runtime, triggers, reads and signed report writes | BUSL-1.1 for the locked 1.23.0 release |
| `zod` | [Zod contributors](https://github.com/colinhacks/zod) | Workflow configuration validation | MIT |
| `typescript` | [Microsoft and TypeScript contributors](https://github.com/microsoft/TypeScript) | Type checking and TypeScript tooling | Apache-2.0 |
| `@types/node`, `@types/react`, `@types/react-dom` | [DefinitelyTyped contributors](https://github.com/DefinitelyTyped/DefinitelyTyped) | Type definitions | MIT |

The [root](../package.json), [web](../web/package.json), [workflow](../cowrie-cre/my-workflow/package.json) and [binding helper](../cowrie-cre/contracts/package.json) manifests declare the direct dependencies. The corresponding [root npm lock](../package-lock.json), [web npm lock](../web/package-lock.json), [workflow Bun lock](../cowrie-cre/my-workflow/bun.lock) and [binding-helper Bun lock](../cowrie-cre/contracts/bun.lock) record their resolved dependency trees. Transitive packages retain the license files supplied with their distributions.

The locked CRE SDK declares Business Source License 1.1. Its [upstream license](https://github.com/smartcontractkit/cre-sdk-typescript/blob/main/LICENSE.md) includes a later change to MIT; the currently installed package's `LICENSE.md` governs that version. The MIT license of the CRE starter template is separate from the SDK's license.

## Fonts and badges

- [Bricolage Grotesque](https://github.com/google/fonts/tree/main/ofl/bricolagegrotesque), by its project authors, is used for headings and prominent amounts. [SIL Open Font License 1.1](https://github.com/google/fonts/blob/main/ofl/bricolagegrotesque/OFL.txt).
- [Hanken Grotesk](https://github.com/google/fonts/tree/main/ofl/hankengrotesk), by its project authors, is used for body text and controls. [SIL Open Font License 1.1](https://github.com/google/fonts/blob/main/ofl/hankengrotesk/OFL.txt).
- Both fonts are loaded through Google Fonts in [globals.css](../web/app/globals.css). The README's technology badges are served by [Shields.io](https://shields.io/); product names and logos identify their respective projects.

## Documentation graphics

The [detailed architecture flow](architecture-flow.svg) is rendered with [Beautiful Mermaid](https://github.com/lukilabs/beautiful-mermaid) (MIT). Architecture PNG exports use [Sharp](https://github.com/lovell/sharp) (Apache-2.0). These are documentation tools, separate from Cowrie's runtime dependencies.

## Hosted integrations

[Monad](https://monad.xyz/) provides the EVM network used for settlement. [Chainlink Data Feeds](https://docs.chain.link/data-feeds) supplies BTC/USD and ETH/USD readings, and Chainlink CRE supplies workflow tooling. [Privy](https://privy.io/) provides authentication and wallet services. The demo frontend is hosted on [Vercel](https://vercel.com/).

The AI endpoints use configurable OpenAI-compatible APIs. Qwen is developed by Alibaba's [Qwen team](https://github.com/QwenLM), and Gemini by [Google](https://ai.google.dev/). Model weights are not distributed in this repository. Contact sync uses Privy-authenticated Redis REST storage; the integration supports services such as [Upstash](https://upstash.com/). Hosted services and model APIs are subject to their providers' terms.

## CRE template notice

From [smartcontractkit/cre-templates](https://github.com/smartcontractkit/cre-templates/blob/main/LICENSE):

```text
MIT License

Copyright (c) 2025 SmartContract

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
