// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSD (Cowrie Dollar)
/// @notice A 6-decimal test stablecoin for the Cowrie demo on Monad testnet.
///         Anyone can mint test dollars. Testnet only — not for production.
contract MockUSD is ERC20 {
    constructor() ERC20("Cowrie Dollar", "cUSD") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint test dollars to any address (open testnet faucet).
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
