// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title AjoCircle
/// @notice Rotating savings circles. Members agree the rules up front, lock a deposit,
/// pay each round, and when a round's timer ends anyone can settle it so the pot goes
/// to that round's collector. A missed payment is covered from the member's deposit.
contract AjoCircle is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    enum Status { Open, Full, Active, Completed, Cancelled }

    struct Circle {
        string name;
        address creator;
        uint256 contribution;
        uint256 deposit;
        uint64 period;
        uint64 joinDeadline;
        uint64 startTime;
        uint8 maxMembers;
        uint8 round;
        Status status;
        uint256 seed;
        address[] members;
        address[] order;
    }

    uint64 public constant MIN_PERIOD = 60;
    uint8 public constant MAX_MEMBERS = 20;
    uint64 public constant DRAW_GRACE = 3 days;

    IERC20 public immutable token;
    address public drawer;
    uint256 public circleCount;

    mapping(uint256 => Circle) private circles;
    mapping(uint256 => mapping(address => bool)) public isMember;
    mapping(uint256 => mapping(address => uint256)) public depositOf;
    mapping(uint256 => mapping(address => uint8)) public strikes;
    mapping(uint256 => mapping(uint8 => mapping(address => bool))) public paid;

    event CircleCreated(uint256 indexed id, address indexed creator, string name, uint256 contribution, uint256 deposit, uint64 period, uint64 joinDeadline, uint8 maxMembers);
    event Joined(uint256 indexed id, address indexed member);
    event OrderSet(uint256 indexed id, uint256 seed, address[] order);
    event Contributed(uint256 indexed id, uint8 indexed round, address indexed member, uint256 amount);
    event Slashed(uint256 indexed id, uint8 indexed round, address indexed member, uint256 amount);
    event RoundSettled(uint256 indexed id, uint8 indexed round, address indexed collector, uint256 pot);
    event Completed(uint256 indexed id);
    event Cancelled(uint256 indexed id);
    event DepositWithdrawn(uint256 indexed id, address indexed member, uint256 amount);
    event DrawerChanged(address indexed drawer);

    modifier exists(uint256 id) {
        require(id != 0 && id <= circleCount, "no such circle");
        _;
    }

    constructor(IERC20 token_, address drawer_) Ownable(msg.sender) {
        require(address(token_) != address(0), "token=0");
        token = token_;
        drawer = drawer_;
        emit DrawerChanged(drawer_);
    }

    /// @notice Set who may record the payout order (later: the CRE workflow's receiver).
    function setDrawer(address drawer_) external onlyOwner {
        drawer = drawer_;
        emit DrawerChanged(drawer_);
    }

    function createCircle(
        string calldata name,
        uint256 contribution,
        uint256 deposit,
        uint64 period,
        uint64 joinDeadline,
        uint8 maxMembers
    ) external nonReentrant returns (uint256 id) {
        require(contribution > 0, "contribution=0");
        require(deposit >= contribution, "deposit<contribution");
        require(period >= MIN_PERIOD, "period too short");
        require(maxMembers >= 2 && maxMembers <= MAX_MEMBERS, "bad size");
        require(joinDeadline > block.timestamp, "deadline passed");

        id = ++circleCount;
        Circle storage c = circles[id];
        c.name = name;
        c.creator = msg.sender;
        c.contribution = contribution;
        c.deposit = deposit;
        c.period = period;
        c.joinDeadline = joinDeadline;
        c.maxMembers = maxMembers;
        c.status = Status.Open;

        emit CircleCreated(id, msg.sender, name, contribution, deposit, period, joinDeadline, maxMembers);
        _join(id, msg.sender);
    }

    function join(uint256 id) external nonReentrant exists(id) {
        _join(id, msg.sender);
    }

    function _join(uint256 id, address who) internal {
        Circle storage c = circles[id];
        require(c.status == Status.Open, "not open");
        require(block.timestamp <= c.joinDeadline, "join closed");
        require(!isMember[id][who], "already joined");
        require(c.members.length < c.maxMembers, "full");

        token.safeTransferFrom(who, address(this), c.deposit);
        isMember[id][who] = true;
        depositOf[id][who] = c.deposit;
        c.members.push(who);
        emit Joined(id, who);

        if (c.members.length == c.maxMembers) c.status = Status.Full;
    }

    /// @notice Record the payout order once the circle is full. Starts round 1.
    function setOrder(uint256 id, address[] calldata order, uint256 seed) external exists(id) {
        require(msg.sender == drawer, "not drawer");
        Circle storage c = circles[id];
        require(c.status == Status.Full, "not ready for draw");

        uint256 n = c.members.length;
        require(order.length == n, "bad order length");
        for (uint256 i = 0; i < n; i++) {
            require(isMember[id][order[i]], "not a member");
            for (uint256 j = 0; j < i; j++) {
                require(order[j] != order[i], "duplicate");
            }
        }

        c.order = order;
        c.seed = seed;
        c.status = Status.Active;
        c.startTime = uint64(block.timestamp);
        c.round = 1;
        emit OrderSet(id, seed, order);
    }

    /// @notice Pay your share for the current round, before the round ends.
    function contribute(uint256 id) external nonReentrant exists(id) {
        Circle storage c = circles[id];
        require(c.status == Status.Active, "not active");
        require(isMember[id][msg.sender], "not a member");
        require(block.timestamp < roundEnd(id, c.round), "round ended");
        require(!paid[id][c.round][msg.sender], "already paid");

        paid[id][c.round][msg.sender] = true;
        token.safeTransferFrom(msg.sender, address(this), c.contribution);
        emit Contributed(id, c.round, msg.sender, c.contribution);
    }

    /// @notice When the timer ends, anyone can call this. The pot goes to the round's collector.
    function settleRound(uint256 id) external nonReentrant exists(id) {
        Circle storage c = circles[id];
        require(c.status == Status.Active, "not active");
        uint8 r = c.round;
        require(block.timestamp >= roundEnd(id, r), "round not over");

        uint256 pot;
        uint256 n = c.members.length;
        for (uint256 i = 0; i < n; i++) {
            address m = c.members[i];
            if (paid[id][r][m]) {
                pot += c.contribution;
            } else {
                strikes[id][m] += 1;
                uint256 d = depositOf[id][m];
                uint256 cut = d >= c.contribution ? c.contribution : d;
                depositOf[id][m] = d - cut;
                pot += cut;
                emit Slashed(id, r, m, cut);
            }
        }

        address collector = c.order[r - 1];
        if (r == n) {
            c.status = Status.Completed;
        } else {
            c.round = r + 1;
        }

        token.safeTransfer(collector, pot);
        emit RoundSettled(id, r, collector, pot);
        if (r == n) emit Completed(id);
    }

    /// @notice Cancel a circle that never filled or was never drawn.
    function cancel(uint256 id) external exists(id) {
        Circle storage c = circles[id];
        require(c.status == Status.Open || c.status == Status.Full, "cannot cancel");
        uint256 allowedAt = uint256(c.joinDeadline) + (c.status == Status.Full ? DRAW_GRACE : 0);
        require(block.timestamp > allowedAt, "too early");
        c.status = Status.Cancelled;
        emit Cancelled(id);
    }

    /// @notice Take back your remaining deposit after a circle completes or is cancelled.
    function withdrawDeposit(uint256 id) external nonReentrant exists(id) {
        Circle storage c = circles[id];
        require(c.status == Status.Completed || c.status == Status.Cancelled, "circle still running");
        uint256 amount = depositOf[id][msg.sender];
        require(amount > 0, "nothing to withdraw");
        depositOf[id][msg.sender] = 0;
        token.safeTransfer(msg.sender, amount);
        emit DepositWithdrawn(id, msg.sender, amount);
    }

    // ---------- Views ----------

    function roundEnd(uint256 id, uint8 round) public view returns (uint256) {
        Circle storage c = circles[id];
        return uint256(c.startTime) + uint256(round) * uint256(c.period);
    }

    /// @notice True when a round's timer has ended and settleRound can be called.
    function isDue(uint256 id) external view exists(id) returns (bool) {
        Circle storage c = circles[id];
        return c.status == Status.Active && block.timestamp >= roundEnd(id, c.round);
    }

    function getCircle(uint256 id) external view exists(id) returns (Circle memory) {
        return circles[id];
    }

    function getMembers(uint256 id) external view exists(id) returns (address[] memory) {
        return circles[id].members;
    }

    function getOrder(uint256 id) external view exists(id) returns (address[] memory) {
        return circles[id].order;
    }
}
