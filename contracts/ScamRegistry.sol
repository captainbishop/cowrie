// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ScamRegistry
/// @notice Community-reportable blocklist of scam addresses. PolicyVault reads
///         isFlagged() before every send. An address is flagged when the owner
///         flags it OR it has been reported at least THRESHOLD times.
contract ScamRegistry is Ownable {
    uint256 public constant THRESHOLD = 3;

    mapping(address => uint256) public reportCount;
    mapping(address => bool) public ownerFlagged;

    event Reported(address indexed account, address indexed reporter, uint256 count);
    event OwnerFlagged(address indexed account, bool flagged);

    constructor() Ownable(msg.sender) {}

    /// @notice Anyone can report an address; THRESHOLD reports auto-flag it.
    function report(address account) external {
        reportCount[account] += 1;
        emit Reported(account, msg.sender, reportCount[account]);
    }

    /// @notice Owner can hard-flag or clear an address (used to seed the demo).
    function setFlag(address account, bool flagged) external onlyOwner {
        ownerFlagged[account] = flagged;
        emit OwnerFlagged(account, flagged);
    }

    function isFlagged(address account) external view returns (bool) {
        return ownerFlagged[account] || reportCount[account] >= THRESHOLD;
    }
}
