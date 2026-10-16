// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Chainlink CRE delivers workflow reports by calling onReport on a receiver.
interface IReceiver is IERC165 {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}

interface IAjoCircle {
    function settleRound(uint256 id) external;
    function setOrder(uint256 id, address[] calldata order, uint256 seed) external;
}

/// @title AjoKeeper
/// @notice Receives reports from a CRE workflow and acts on the AjoCircle contract:
/// action 1 = settle a round whose timer has ended, action 2 = record the fair draw.
/// Only the configured Chainlink forwarder can call onReport.
contract AjoKeeper is IReceiver, Ownable {
    uint8 public constant ACTION_SETTLE = 1;
    uint8 public constant ACTION_SET_ORDER = 2;

    IAjoCircle public immutable ajo;
    address public forwarder;

    error InvalidForwarder();
    error InvalidSender(address sender, address expected);
    error UnknownAction(uint8 action);

    event ForwarderUpdated(address indexed previous, address indexed current);
    event Settled(uint256 indexed id);
    event OrderRecorded(uint256 indexed id, uint256 seed);

    constructor(address ajo_, address forwarder_) Ownable(msg.sender) {
        if (ajo_ == address(0) || forwarder_ == address(0)) revert InvalidForwarder();
        ajo = IAjoCircle(ajo_);
        forwarder = forwarder_;
        emit ForwarderUpdated(address(0), forwarder_);
    }

    /// @notice Switch between the simulation (mock) forwarder and the production forwarder.
    function setForwarder(address forwarder_) external onlyOwner {
        if (forwarder_ == address(0)) revert InvalidForwarder();
        emit ForwarderUpdated(forwarder, forwarder_);
        forwarder = forwarder_;
    }

    function onReport(bytes calldata, bytes calldata report) external override {
        if (msg.sender != forwarder) revert InvalidSender(msg.sender, forwarder);

        (uint8 action, uint256 id, address[] memory order, uint256 seed) =
            abi.decode(report, (uint8, uint256, address[], uint256));

        if (action == ACTION_SETTLE) {
            ajo.settleRound(id);
            emit Settled(id);
        } else if (action == ACTION_SET_ORDER) {
            ajo.setOrder(id, order, seed);
            emit OrderRecorded(id, seed);
        } else {
            revert UnknownAction(action);
        }
    }

    function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}