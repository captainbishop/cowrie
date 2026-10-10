// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IScamRegistry {
    function isFlagged(address account) external view returns (bool);
}

interface IMintableUSD is IERC20 {
    function mint(address to, uint256 amount) external;
}

/// @title PolicyVault
/// @notice Holds cUSD for each user and enforces plain-English money rules on-chain:
///         auto-save a % of every receipt, a daily spend cap, a streaming allowance,
///         and a scam-guarded send. Balances are internal; withdraw() exits to the wallet.
contract PolicyVault is ReentrancyGuard {
    IMintableUSD public immutable token;
    IScamRegistry public immutable scam;

    mapping(address => uint256) public spendable; // free balance
    mapping(address => uint256) public savings; // locked pot
    mapping(address => uint16) public autosaveBps; // 0..10000 routed to savings on receipt
    mapping(address => uint256) public dailyCap; // 0 = no cap
    mapping(address => uint256) private spentToday;
    mapping(address => uint256) private lastSpendDay;

    struct Allowance {
        uint256 ratePerDay;
        uint256 lastClaim;
        bool active;
    }

    mapping(address => mapping(address => Allowance)) public allowances; // from => to

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Sent(address indexed from, address indexed to, uint256 amount, uint256 autoSaved);
    event AutoSaved(address indexed user, uint256 amount);
    event SavingsUnlocked(address indexed user, uint256 amount);
    event RuleChanged(address indexed user, string rule);
    event AllowanceSet(address indexed from, address indexed to, uint256 ratePerDay);
    event AllowanceClaimed(address indexed from, address indexed to, uint256 amount);

    constructor(IMintableUSD _token, IScamRegistry _scam) {
        token = _token;
        scam = _scam;
    }

    // ---------- funding ----------
    function deposit(uint256 amount) external nonReentrant {
        require(token.transferFrom(msg.sender, address(this), amount), "transfer failed");
        spendable[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    /// @notice Demo convenience: mint test cUSD straight into your spendable balance.
    function mintAndDeposit(uint256 amount) external nonReentrant {
        token.mint(address(this), amount);
        spendable[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(spendable[msg.sender] >= amount, "insufficient");
        spendable[msg.sender] -= amount;
        require(token.transfer(msg.sender, amount), "transfer failed");
        emit Withdrawn(msg.sender, amount);
    }

    // ---------- rules ----------
    function setAutosave(uint16 bps) external {
        require(bps <= 10000, "bps > 100%");
        autosaveBps[msg.sender] = bps;
        emit RuleChanged(msg.sender, "autosave");
    }

    function setDailyCap(uint256 cap) external {
        dailyCap[msg.sender] = cap;
        emit RuleChanged(msg.sender, "dailyCap");
    }

    function unlockSavings(uint256 amount) external {
        require(savings[msg.sender] >= amount, "insufficient savings");
        savings[msg.sender] -= amount;
        spendable[msg.sender] += amount;
        emit SavingsUnlocked(msg.sender, amount);
    }

    // ---------- send: scam-guarded, cap-enforced, auto-save on receipt ----------
    function send(address to, uint256 amount) external nonReentrant {
        require(to != address(0), "zero recipient");
        require(!scam.isFlagged(to), "recipient flagged as scam");
        _spendWithCap(msg.sender, amount);
        uint256 saved = _credit(to, amount);
        emit Sent(msg.sender, to, amount, saved);
    }

    function _spendWithCap(address user, uint256 amount) internal {
        uint256 today = block.timestamp / 1 days;
        if (lastSpendDay[user] != today) {
            spentToday[user] = 0;
            lastSpendDay[user] = today;
        }
        require(spendable[user] >= amount, "insufficient");
        uint256 cap = dailyCap[user];
        if (cap != 0) require(spentToday[user] + amount <= cap, "daily cap exceeded");
        spendable[user] -= amount;
        spentToday[user] += amount;
    }

    function _credit(address to, uint256 amount) internal returns (uint256 saved) {
        uint16 bps = autosaveBps[to];
        saved = bps == 0 ? 0 : (amount * bps) / 10000;
        if (saved > 0) {
            savings[to] += saved;
            emit AutoSaved(to, saved);
        }
        spendable[to] += amount - saved;
    }

    // ---------- streaming allowance ----------
    function setAllowance(address to, uint256 ratePerDay) external {
        require(to != address(0), "zero beneficiary");
        allowances[msg.sender][to] = Allowance(ratePerDay, block.timestamp, ratePerDay > 0);
        emit AllowanceSet(msg.sender, to, ratePerDay);
    }

    function accrued(address from, address to) public view returns (uint256) {
        Allowance memory a = allowances[from][to];
        if (!a.active) return 0;
        uint256 owed = (a.ratePerDay * (block.timestamp - a.lastClaim)) / 1 days;
        uint256 avail = spendable[from];
        return owed < avail ? owed : avail;
    }

    function claimAllowance(address from) external nonReentrant {
        Allowance storage a = allowances[from][msg.sender];
        require(a.active, "no allowance");
        uint256 pay = accrued(from, msg.sender);
        require(pay > 0, "nothing accrued");
        a.lastClaim = block.timestamp;
        spendable[from] -= pay;
        _credit(msg.sender, pay);
        emit AllowanceClaimed(from, msg.sender, pay);
    }

    // ---------- views ----------
    function spentTodayOf(address user) external view returns (uint256) {
        if (lastSpendDay[user] != block.timestamp / 1 days) return 0;
        return spentToday[user];
    }
}
