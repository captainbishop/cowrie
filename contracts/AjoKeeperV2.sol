// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IReceiver} from "./AjoKeeper.sol";

interface IAjoCircleV2 {
    function settleRound(uint256 id) external;
    function setOrder(uint256 id, address[] calldata order, uint256 seed) external;
    function pullAll(uint256 id) external;
}

/// @title AjoKeeperV2
/// @notice Receives reports from the CRE workflow: 1 = settle a round, 2 = record the draw, 3 = pull auto-pay shares.
/// Once the workflow is deployed, pin it with setExpectedWorkflowId so only that workflow's reports are accepted.
contract AjoKeeperV2 is IReceiver, Ownable {
    uint8 public constant ACTION_SETTLE = 1;
    uint8 public constant ACTION_SET_ORDER = 2;
    uint8 public constant ACTION_PULL = 3;

    IAjoCircleV2 public immutable ajo;
    address public forwarder;
    bytes32 public expectedWorkflowId;

    error InvalidForwarder();
    error InvalidSender(address sender, address expected);
    error WrongWorkflow();
    error UnknownAction(uint8 action);

    event ForwarderUpdated(address indexed previous, address indexed current);
    event WorkflowPinned(bytes32 indexed workflowId);
    event Settled(uint256 indexed id);
    event OrderRecorded(uint256 indexed id, uint256 seed);
    event Pulled(uint256 indexed id);

    constructor(address ajo_, address forwarder_) Ownable(msg.sender) {
        if (ajo_ == address(0) || forwarder_ == address(0)) revert InvalidForwarder();
        ajo = IAjoCircleV2(ajo_);
        forwarder = forwarder_;
        emit ForwarderUpdated(address(0), forwarder_);
    }

    function setForwarder(address forwarder_) external onlyOwner {
        if (forwarder_ == address(0)) revert InvalidForwarder();
        emit ForwarderUpdated(forwarder, forwarder_);
        forwarder = forwarder_;
    }

    /// @notice Only reports from this workflow are accepted. Leave at zero while using the simulation forwarder.
    function setExpectedWorkflowId(bytes32 id) external onlyOwner {
        expectedWorkflowId = id;
        emit WorkflowPinned(id);
    }

    function onReport(bytes calldata metadata, bytes calldata report) external override {
        if (msg.sender != forwarder) revert InvalidSender(msg.sender, forwarder);
        if (expectedWorkflowId != bytes32(0)) {
            if (metadata.length < 32 || bytes32(metadata[0:32]) != expectedWorkflowId) revert WrongWorkflow();
        }

        (uint8 action, uint256 id, address[] memory order, uint256 seed) =
            abi.decode(report, (uint8, uint256, address[], uint256));

        if (action == ACTION_SETTLE) {
            ajo.settleRound(id);
            emit Settled(id);
        } else if (action == ACTION_SET_ORDER) {
            ajo.setOrder(id, order, seed);
            emit OrderRecorded(id, seed);
        } else if (action == ACTION_PULL) {
            ajo.pullAll(id);
            emit Pulled(id);
        } else {
            revert UnknownAction(action);
        }
    }

    function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
