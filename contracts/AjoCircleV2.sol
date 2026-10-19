// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title AjoCircleV2
/// @notice Rotating savings circles. Members lock a deposit and pay each round; when a round's timer ends the
/// whole pot goes to that round's collector. The payout order is drawn by an authorised drawer (the Chainlink CRE
/// keeper). If CRE has not drawn within `fallbackDelay`, anyone can run an on-chain fallback draw, and the circle
/// records which path was used. The owner can switch the fallback off.
contract AjoCircleV2 is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    enum Status { Open, Full, Active, Completed, Cancelled, Ended }

    struct CircleParams {
        string name;
        uint256 contribution;
        uint256 deposit;
        uint64 period;
        uint64 joinDeadline;
        uint8 maxMembers;
    }

    struct Circle {
        string name;
        address creator;
        uint256 contribution;
        uint256 deposit;
        uint64 period;
        uint64 joinDeadline;
        uint64 roundStart;
        uint64 fullAt;
        uint8 maxMembers;
        uint8 round;
        Status status;
        bool inviteOnly;
        uint8 drawnBy; // 0 not drawn, 1 authorised drawer (CRE), 2 on-chain fallback
        uint256 seed;
        address[] members;
        address[] order;
    }

    /// @dev Everything the app needs about one circle and one user, in a single call.
    struct Brief {
        uint256 id;
        string name;
        address creator;
        uint256 contribution;
        uint256 deposit;
        uint64 period;
        uint64 joinDeadline;
        uint64 fullAt;
        uint8 maxMembers;
        uint8 round;
        uint8 status;
        bool inviteOnly;
        uint8 drawnBy;
        bool isMember;
        bool isInvited;
        bool paidNow;
        bool autopayOn;
        bool endVotedByMe;
        uint256 myDeposit;
        uint8 myStrikes;
        uint256 roundEndsAt;
        uint256 endVotes;
        address[] members;
        address[] order;
    }

    uint64 public constant MIN_PERIOD = 60;
    uint8 public constant MAX_MEMBERS = 20;
    uint64 public constant DRAW_GRACE = 3 days;
    uint256 public constant MAX_INVITES = 50;

    IERC20 public immutable token;
    mapping(address => bool) public isDrawer;
    bool public fallbackEnabled = true;
    uint64 public fallbackDelay = 600;
    uint256 public circleCount;

    mapping(uint256 => Circle) private circles;
    mapping(uint256 => mapping(address => bool)) public isMember;
    mapping(uint256 => mapping(address => bool)) public isInvited;
    mapping(uint256 => mapping(address => uint256)) public depositOf;
    mapping(uint256 => mapping(address => uint8)) public strikes;
    mapping(uint256 => mapping(uint8 => mapping(address => bool))) public paid;
    mapping(uint256 => mapping(address => bool)) public autopay;
    mapping(uint256 => mapping(address => bool)) public endVoted;
    mapping(uint256 => uint256) public endVotes;
    mapping(uint256 => uint256) public fallbackBlock;
    mapping(uint256 => uint8) public pullRound; // last round for which an automatic pull was attempted

    event CircleCreated(uint256 indexed id, address indexed creator, string name, uint256 contribution, uint256 deposit, uint64 period, uint64 joinDeadline, uint8 maxMembers, bool inviteOnly);
    event Joined(uint256 indexed id, address indexed member);
    event Left(uint256 indexed id, address indexed member);
    event Invited(uint256 indexed id, address indexed who);
    event BecameFull(uint256 indexed id);
    event Drawn(uint256 indexed id, uint8 by, uint256 seed, address[] order);
    event FallbackRequested(uint256 indexed id, uint256 targetBlock);
    event Contributed(uint256 indexed id, uint8 indexed round, address indexed member, uint256 amount);
    event Slashed(uint256 indexed id, uint8 indexed round, address indexed member, uint256 amount);
    event RoundSettled(uint256 indexed id, uint8 indexed round, address indexed collector, uint256 pot);
    event Completed(uint256 indexed id);
    event Cancelled(uint256 indexed id);
    event EndVoted(uint256 indexed id, address indexed member, uint256 votes);
    event EndVoteRetracted(uint256 indexed id, address indexed member);
    event Ended(uint256 indexed id);
    event DepositWithdrawn(uint256 indexed id, address indexed member, uint256 amount);
    event AutopayChanged(uint256 indexed id, address indexed member, bool on);
    event DrawerChanged(address indexed drawer, bool allowed);
    event FallbackChanged(bool enabled, uint64 delay);

    modifier exists(uint256 id) {
        require(id != 0 && id <= circleCount, "no such circle");
        _;
    }

    constructor(IERC20 token_, address drawer_) Ownable(msg.sender) {
        require(address(token_) != address(0), "token=0");
        token = token_;
        if (drawer_ != address(0)) {
            isDrawer[drawer_] = true;
            emit DrawerChanged(drawer_, true);
        }
    }

    // ---------- admin ----------

    function setDrawer(address who, bool allowed) external onlyOwner {
        isDrawer[who] = allowed;
        emit DrawerChanged(who, allowed);
    }

    /// @notice Switch the on-chain fallback draw on or off, and set how long CRE gets before it can be used.
    function setFallback(bool enabled, uint64 delay) external onlyOwner {
        require(delay >= 60 && delay <= 7 days, "bad delay");
        fallbackEnabled = enabled;
        fallbackDelay = delay;
        emit FallbackChanged(enabled, delay);
    }

    // ---------- creating and joining ----------

    function createCircle(
        string calldata name,
        uint256 contribution,
        uint256 deposit,
        uint64 period,
        uint64 joinDeadline,
        uint8 maxMembers
    ) external nonReentrant returns (uint256 id) {
        id = _create(CircleParams(name, contribution, deposit, period, joinDeadline, maxMembers), false);
        _join(id, msg.sender);
    }

    function createInviteOnlyCircle(CircleParams calldata p, address[] calldata invited)
        external
        nonReentrant
        returns (uint256 id)
    {
        require(invited.length > 0 && invited.length <= MAX_INVITES, "bad invite list");
        id = _create(p, true);
        _invite(id, invited);
        _join(id, msg.sender);
    }

    function _create(CircleParams memory p, bool inviteOnly) internal returns (uint256 id) {
        require(p.contribution > 0, "contribution=0");
        require(p.deposit >= p.contribution, "deposit<contribution");
        require(p.period >= MIN_PERIOD, "period too short");
        require(p.maxMembers >= 2 && p.maxMembers <= MAX_MEMBERS, "bad size");
        require(p.joinDeadline > block.timestamp, "deadline passed");

        id = ++circleCount;
        Circle storage c = circles[id];
        c.name = p.name;
        c.creator = msg.sender;
        c.contribution = p.contribution;
        c.deposit = p.deposit;
        c.period = p.period;
        c.joinDeadline = p.joinDeadline;
        c.maxMembers = p.maxMembers;
        c.status = Status.Open;
        c.inviteOnly = inviteOnly;
        emit CircleCreated(id, msg.sender, p.name, p.contribution, p.deposit, p.period, p.joinDeadline, p.maxMembers, inviteOnly);
    }

    /// @notice The creator can invite more people while the circle is still open.
    function invite(uint256 id, address[] calldata who) external exists(id) {
        Circle storage c = circles[id];
        require(msg.sender == c.creator, "not creator");
        require(c.inviteOnly, "open to anyone");
        require(c.status == Status.Open, "not open");
        require(who.length > 0 && who.length <= MAX_INVITES, "bad invite list");
        _invite(id, who);
    }

    function _invite(uint256 id, address[] calldata who) internal {
        for (uint256 i = 0; i < who.length; i++) {
            require(who[i] != address(0), "zero address");
            isInvited[id][who[i]] = true;
            emit Invited(id, who[i]);
        }
    }

    function join(uint256 id) external nonReentrant exists(id) {
        _join(id, msg.sender);
    }

    function _join(uint256 id, address who) internal {
        Circle storage c = circles[id];
        require(c.status == Status.Open, "not open");
        require(block.timestamp <= c.joinDeadline, "join closed");
        if (c.inviteOnly) require(who == c.creator || isInvited[id][who], "not invited");
        require(!isMember[id][who], "already joined");
        require(c.members.length < c.maxMembers, "full");

        token.safeTransferFrom(who, address(this), c.deposit);
        isMember[id][who] = true;
        depositOf[id][who] = c.deposit;
        c.members.push(who);
        emit Joined(id, who);

        if (c.members.length == c.maxMembers) {
            c.status = Status.Full;
            c.fullAt = uint64(block.timestamp);
            emit BecameFull(id);
        }
    }

    /// @notice Leave a circle that has not filled yet and take your deposit back. The creator cancels instead.
    function leave(uint256 id) external nonReentrant exists(id) {
        Circle storage c = circles[id];
        require(c.status == Status.Open, "not open");
        require(isMember[id][msg.sender], "not a member");
        require(msg.sender != c.creator, "creator should cancel instead");

        uint256 n = c.members.length;
        for (uint256 i = 0; i < n; i++) {
            if (c.members[i] == msg.sender) {
                c.members[i] = c.members[n - 1];
                c.members.pop();
                break;
            }
        }
        isMember[id][msg.sender] = false;
        uint256 d = depositOf[id][msg.sender];
        depositOf[id][msg.sender] = 0;
        token.safeTransfer(msg.sender, d);
        emit Left(id, msg.sender);
    }

    /// @notice The creator can cancel any time before the draw. Anyone can close a circle that has expired.
    function cancel(uint256 id) external exists(id) {
        Circle storage c = circles[id];
        require(c.status == Status.Open || c.status == Status.Full, "cannot cancel");
        if (msg.sender != c.creator) {
            uint256 allowedAt = uint256(c.joinDeadline) + (c.status == Status.Full ? DRAW_GRACE : 0);
            require(block.timestamp > allowedAt, "too early");
        }
        c.status = Status.Cancelled;
        emit Cancelled(id);
    }

    // ---------- the draw ----------

    /// @notice The authorised drawer (the CRE keeper) records the payout order.
    function setOrder(uint256 id, address[] calldata order, uint256 seed) external exists(id) {
        require(isDrawer[msg.sender], "not drawer");
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
        _start(id, order, seed, 1);
    }

    /// @notice Step 1 of the fallback: only after CRE has had `fallbackDelay` to draw.
    function requestFallbackDraw(uint256 id) external exists(id) {
        require(fallbackEnabled, "fallback off");
        Circle storage c = circles[id];
        require(c.status == Status.Full, "not ready for draw");
        require(block.timestamp >= uint256(c.fullAt) + fallbackDelay, "CRE has not had its turn yet");
        uint256 pending = fallbackBlock[id];
        require(pending == 0 || block.number > pending + 250, "already requested");
        fallbackBlock[id] = block.number + 2;
        emit FallbackRequested(id, block.number + 2);
    }

    /// @notice Step 2 of the fallback: uses the hash of a block nobody could know when the request was made.
    function finishFallbackDraw(uint256 id) external exists(id) {
        require(fallbackEnabled, "fallback off");
        Circle storage c = circles[id];
        require(c.status == Status.Full, "not ready for draw");
        uint256 target = fallbackBlock[id];
        require(target != 0 && block.number > target, "not ready yet");
        require(block.number - target <= 250, "expired, request again");
        uint256 seed = uint256(keccak256(abi.encode(blockhash(target), id)));
        address[] memory order = _shuffle(c.members, seed);
        _start(id, order, seed, 2);
    }

    function _start(uint256 id, address[] memory order, uint256 seed, uint8 by) internal {
        Circle storage c = circles[id];
        c.order = order;
        c.seed = seed;
        c.drawnBy = by;
        c.status = Status.Active;
        c.roundStart = uint64(block.timestamp);
        c.round = 1;
        emit Drawn(id, by, seed, order);
    }

    function _shuffle(address[] memory m, uint256 seed) internal pure returns (address[] memory) {
        for (uint256 i = m.length - 1; i > 0; i--) {
            seed = uint256(keccak256(abi.encode(seed, i)));
            uint256 j = seed % (i + 1);
            (m[i], m[j]) = (m[j], m[i]);
        }
        return m;
    }

    // ---------- paying and settling ----------

    function contribute(uint256 id) external nonReentrant exists(id) {
        Circle storage c = circles[id];
        require(c.status == Status.Active, "not active");
        require(isMember[id][msg.sender], "not a member");
        require(block.timestamp < roundEnd(id), "round ended");
        require(!paid[id][c.round][msg.sender], "already paid");

        paid[id][c.round][msg.sender] = true;
        token.safeTransferFrom(msg.sender, address(this), c.contribution);
        emit Contributed(id, c.round, msg.sender, c.contribution);
    }

    /// @notice Members can opt in to having their share pulled automatically each round.
    function setAutopay(uint256 id, bool on) external exists(id) {
        require(isMember[id][msg.sender], "not a member");
        Circle storage c = circles[id];
        require(c.status <= Status.Active, "circle is over");
        autopay[id][msg.sender] = on;
        emit AutopayChanged(id, msg.sender, on);
    }

    /// @notice Anyone can pull the exact share from a member who opted in. Used by the CRE workflow each round.
    function pullFor(uint256 id, address member) external nonReentrant exists(id) {
        Circle storage c = circles[id];
        require(c.status == Status.Active, "not active");
        require(autopay[id][member] && isMember[id][member], "autopay off");
        require(block.timestamp < roundEnd(id), "round ended");
        require(!paid[id][c.round][member], "already paid");

        paid[id][c.round][member] = true;
        token.safeTransferFrom(member, address(this), c.contribution);
        emit Contributed(id, c.round, member, c.contribution);
    }

    /// @notice Pull from every opted-in member who has not paid; skips anyone who cannot pay right now.
    function pullAll(uint256 id) external exists(id) {
        Circle storage c = circles[id];
        require(c.status == Status.Active, "not active");
        require(pullRound[id] != c.round, "already attempted this round");
        pullRound[id] = c.round;
        address[] memory m = c.members;
        for (uint256 i = 0; i < m.length; i++) {
            try this.pullFor(id, m[i]) {} catch {}
        }
    }

    /// @notice When a round's timer ends anyone can settle it. The pot goes to the round's collector.
    function settleRound(uint256 id) external nonReentrant exists(id) {
        Circle storage c = circles[id];
        require(c.status == Status.Active, "not active");
        uint8 r = c.round;
        require(block.timestamp >= roundEnd(id), "round not over");

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
            c.roundStart = uint64(block.timestamp);
        }

        token.safeTransfer(collector, pot);
        emit RoundSettled(id, r, collector, pot);
        if (r == n) emit Completed(id);
    }

    // ---------- ending a running circle ----------

    /// @notice Vote to end a running circle. It ends only when every member has voted. Payments already
    /// collected by earlier winners are not undone; this round's payments are refunded and deposits released.
    function voteEnd(uint256 id) external nonReentrant exists(id) {
        Circle storage c = circles[id];
        require(c.status == Status.Active, "not active");
        require(isMember[id][msg.sender], "not a member");
        require(!endVoted[id][msg.sender], "already voted");

        endVoted[id][msg.sender] = true;
        endVotes[id] += 1;
        emit EndVoted(id, msg.sender, endVotes[id]);

        if (endVotes[id] == c.members.length) {
            c.status = Status.Ended;
            uint8 r = c.round;
            uint256 n = c.members.length;
            for (uint256 i = 0; i < n; i++) {
                address m = c.members[i];
                if (paid[id][r][m]) {
                    paid[id][r][m] = false;
                    token.safeTransfer(m, c.contribution);
                }
            }
            emit Ended(id);
        }
    }

    function retractEndVote(uint256 id) external exists(id) {
        Circle storage c = circles[id];
        require(c.status == Status.Active, "not active");
        require(endVoted[id][msg.sender], "no vote to retract");
        endVoted[id][msg.sender] = false;
        endVotes[id] -= 1;
        emit EndVoteRetracted(id, msg.sender);
    }

    // ---------- getting deposits back ----------

    function withdrawDeposit(uint256 id) external nonReentrant exists(id) {
        Circle storage c = circles[id];
        require(
            c.status == Status.Completed || c.status == Status.Cancelled || c.status == Status.Ended,
            "circle still running"
        );
        uint256 amount = depositOf[id][msg.sender];
        require(amount > 0, "nothing to withdraw");
        depositOf[id][msg.sender] = 0;
        token.safeTransfer(msg.sender, amount);
        emit DepositWithdrawn(id, msg.sender, amount);
    }

    // ---------- views ----------

    function roundEnd(uint256 id) public view returns (uint256) {
        Circle storage c = circles[id];
        return uint256(c.roundStart) + uint256(c.period);
    }

    function isDue(uint256 id) external view exists(id) returns (bool) {
        Circle storage c = circles[id];
        return c.status == Status.Active && block.timestamp >= roundEnd(id);
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

    /// @notice The newest `maxItems` circles with everything the app needs for `user`, in one call.
    function overview(address user, uint256 maxItems) external view returns (Brief[] memory out) {
        uint256 n = circleCount;
        uint256 take = n < maxItems ? n : maxItems;
        out = new Brief[](take);
        for (uint256 k = 0; k < take; k++) {
            out[k] = _brief(n - k, user);
        }
    }

    function _brief(uint256 id, address u) internal view returns (Brief memory b) {
        Circle storage c = circles[id];
        b.id = id;
        b.name = c.name;
        b.creator = c.creator;
        b.contribution = c.contribution;
        b.deposit = c.deposit;
        b.period = c.period;
        b.joinDeadline = c.joinDeadline;
        b.fullAt = c.fullAt;
        b.maxMembers = c.maxMembers;
        b.round = c.round;
        b.status = uint8(c.status);
        b.inviteOnly = c.inviteOnly;
        b.drawnBy = c.drawnBy;
        b.isMember = isMember[id][u];
        b.isInvited = isInvited[id][u];
        b.paidNow = c.round > 0 && paid[id][c.round][u];
        b.autopayOn = autopay[id][u];
        b.endVotedByMe = endVoted[id][u];
        b.myDeposit = depositOf[id][u];
        b.myStrikes = strikes[id][u];
        b.roundEndsAt = c.status == Status.Active ? roundEnd(id) : 0;
        b.endVotes = endVotes[id];
        b.members = c.members;
        b.order = c.order;
    }
}
