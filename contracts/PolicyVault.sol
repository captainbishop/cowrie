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

    uint16 public constant EARN_APR_BPS = 1000; // 10.00% a year, a demo rate on testnet
    mapping(address => uint256) public earnPrincipal; // balance moved into the earn vault
    mapping(address => uint256) public earnSince; // timestamp of the last accrual

    // swap: a constant-product AMM, cUSD against any token that has a pool
    mapping(address => uint256) public poolCusd; // cUSD reserve per asset
    mapping(address => uint256) public poolTok; // asset reserve per asset
    mapping(address => mapping(address => uint256)) public holding; // user => asset => amount held
    address[] public listedTokens;

    // predict: a simple parimutuel YES/NO prediction market
    struct Market { string question; uint64 closeTime; bool resolved; bool outcome; uint256 poolYes; uint256 poolNo; }
    Market[] public markets;
    mapping(uint256 => mapping(address => uint256)) public betYes;
    mapping(uint256 => mapping(address => uint256)) public betNo;
    mapping(uint256 => mapping(address => bool)) public claimedBet;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Sent(address indexed from, address indexed to, uint256 amount, uint256 autoSaved);
    event AutoSaved(address indexed user, uint256 amount);
    event SavingsUnlocked(address indexed user, uint256 amount);
    event RuleChanged(address indexed user, string rule);
    event AllowanceSet(address indexed from, address indexed to, uint256 ratePerDay);
    event AllowanceClaimed(address indexed from, address indexed to, uint256 amount);
    event EarnStarted(address indexed user, uint256 amount);
    event EarnStopped(address indexed user, uint256 amount);
    event YieldPaid(address indexed user, uint256 amount);
    event PoolSeeded(address indexed asset, uint256 cusd, uint256 tok);
    event Swapped(address indexed user, address indexed asset, bool cusdToToken, uint256 amountIn, uint256 amountOut);
    event MarketCreated(uint256 indexed id, string question, uint64 closeTime);
    event Predicted(uint256 indexed id, address indexed user, bool side, uint256 amount);
    event MarketResolved(uint256 indexed id, bool outcome);
    event PredictionClaimed(uint256 indexed id, address indexed user, uint256 payout);

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

    // ---------- earn: a yield-bearing savings vault ----------
    /// @notice Move spendable into the earn vault, where it grows at EARN_APR_BPS a year.
    function startEarning(uint256 amount) external nonReentrant {
        require(amount > 0, "zero");
        _accrueEarn(msg.sender);
        require(spendable[msg.sender] >= amount, "insufficient");
        spendable[msg.sender] -= amount;
        earnPrincipal[msg.sender] += amount;
        emit EarnStarted(msg.sender, amount);
    }

    /// @notice Move part of your earning balance back to spendable (accrues yield first).
    function stopEarning(uint256 amount) external nonReentrant {
        _accrueEarn(msg.sender);
        require(amount > 0 && earnPrincipal[msg.sender] >= amount, "insufficient earning");
        earnPrincipal[msg.sender] -= amount;
        spendable[msg.sender] += amount;
        emit EarnStopped(msg.sender, amount);
    }

    /// @notice Move your whole earning balance, with the yield earned, back to spendable.
    function stopAllEarning() external nonReentrant {
        _accrueEarn(msg.sender);
        uint256 p = earnPrincipal[msg.sender];
        require(p > 0, "nothing earning");
        earnPrincipal[msg.sender] = 0;
        spendable[msg.sender] += p;
        emit EarnStopped(msg.sender, p);
    }

    /// @notice Fold accrued yield into principal and mint it so the vault can pay it out.
    function _accrueEarn(address user) internal {
        uint256 p = earnPrincipal[user];
        uint256 since = earnSince[user];
        if (p > 0 && since != 0 && block.timestamp > since) {
            uint256 earned = (p * EARN_APR_BPS * (block.timestamp - since)) / (10000 * 365 days);
            if (earned > 0) {
                token.mint(address(this), earned);
                earnPrincipal[user] = p + earned;
                emit YieldPaid(user, earned);
            }
        }
        earnSince[user] = block.timestamp;
    }

    /// @notice Your earning balance including yield accrued since the last update.
    function earnedOf(address user) external view returns (uint256) {
        uint256 p = earnPrincipal[user];
        uint256 since = earnSince[user];
        if (p == 0 || since == 0 || block.timestamp <= since) return p;
        uint256 earned = (p * EARN_APR_BPS * (block.timestamp - since)) / (10000 * 365 days);
        return p + earned;
    }

    // ---------- swap: a constant-product AMM, cUSD against any token ----------
    /// @notice Add liquidity for an asset's cUSD pool. Open on testnet so the demo can seed pools.
    function seedPool(address asset, uint256 cusdAmount, uint256 assetAmount) external nonReentrant {
        require(asset != address(0) && asset != address(token), "bad asset");
        require(cusdAmount > 0 && assetAmount > 0, "zero");
        require(token.transferFrom(msg.sender, address(this), cusdAmount), "cusd in");
        require(IERC20(asset).transferFrom(msg.sender, address(this), assetAmount), "asset in");
        if (poolCusd[asset] == 0 && poolTok[asset] == 0) listedTokens.push(asset);
        poolCusd[asset] += cusdAmount;
        poolTok[asset] += assetAmount;
        emit PoolSeeded(asset, cusdAmount, assetAmount);
    }

    /// @notice Swap spendable cUSD for an asset; the asset is kept in your Cowrie holding.
    function swapCusdForToken(address asset, uint256 cusdIn) external nonReentrant returns (uint256 out) {
        require(poolCusd[asset] > 0 && poolTok[asset] > 0, "no pool");
        require(cusdIn > 0 && spendable[msg.sender] >= cusdIn, "insufficient");
        uint256 inWithFee = (cusdIn * 997) / 1000;
        out = (poolTok[asset] * inWithFee) / (poolCusd[asset] + inWithFee);
        require(out > 0 && out < poolTok[asset], "bad out");
        spendable[msg.sender] -= cusdIn;
        poolCusd[asset] += cusdIn;
        poolTok[asset] -= out;
        holding[msg.sender][asset] += out;
        emit Swapped(msg.sender, asset, true, cusdIn, out);
    }

    /// @notice Swap an asset you hold back into spendable cUSD.
    function swapTokenForCusd(address asset, uint256 tokIn) external nonReentrant returns (uint256 out) {
        require(poolCusd[asset] > 0 && poolTok[asset] > 0, "no pool");
        require(tokIn > 0 && holding[msg.sender][asset] >= tokIn, "insufficient");
        uint256 inWithFee = (tokIn * 997) / 1000;
        out = (poolCusd[asset] * inWithFee) / (poolTok[asset] + inWithFee);
        require(out > 0 && out < poolCusd[asset], "bad out");
        holding[msg.sender][asset] -= tokIn;
        poolTok[asset] += tokIn;
        poolCusd[asset] -= out;
        spendable[msg.sender] += out;
        emit Swapped(msg.sender, asset, false, tokIn, out);
    }

    function quoteCusdForToken(address asset, uint256 cusdIn) external view returns (uint256) {
        if (poolCusd[asset] == 0 || cusdIn == 0) return 0;
        uint256 inWithFee = (cusdIn * 997) / 1000;
        return (poolTok[asset] * inWithFee) / (poolCusd[asset] + inWithFee);
    }

    function quoteTokenForCusd(address asset, uint256 tokIn) external view returns (uint256) {
        if (poolTok[asset] == 0 || tokIn == 0) return 0;
        uint256 inWithFee = (tokIn * 997) / 1000;
        return (poolCusd[asset] * inWithFee) / (poolTok[asset] + inWithFee);
    }

    /// @notice What your current holding of an asset is worth in cUSD if sold now.
    function holdingValue(address user, address asset) external view returns (uint256) {
        uint256 h = holding[user][asset];
        if (h == 0 || poolTok[asset] == 0) return 0;
        return (poolCusd[asset] * h) / (poolTok[asset] + h);
    }

    function listedTokensCount() external view returns (uint256) {
        return listedTokens.length;
    }

    // ---------- predict: a parimutuel YES/NO prediction market ----------
    function createMarket(string calldata question, uint64 closeTime) external returns (uint256 id) {
        id = markets.length;
        markets.push(Market(question, closeTime, false, false, 0, 0));
        emit MarketCreated(id, question, closeTime);
    }

    /// @notice Stake spendable cUSD on YES (true) or NO (false) of a market.
    function predict(uint256 id, bool side, uint256 amount) external nonReentrant {
        Market storage m = markets[id];
        require(!m.resolved, "resolved");
        require(amount > 0 && spendable[msg.sender] >= amount, "insufficient");
        spendable[msg.sender] -= amount;
        if (side) { m.poolYes += amount; betYes[id][msg.sender] += amount; }
        else { m.poolNo += amount; betNo[id][msg.sender] += amount; }
        emit Predicted(id, msg.sender, side, amount);
    }

    /// @notice Settle a market. Open on testnet for the demo; a production build gates this to an oracle.
    function resolveMarket(uint256 id, bool outcome) external {
        Market storage m = markets[id];
        require(!m.resolved, "resolved");
        m.resolved = true;
        m.outcome = outcome;
        emit MarketResolved(id, outcome);
    }

    /// @notice Claim your winnings from a resolved market (parimutuel: your stake's share of the whole pool).
    function claimPrediction(uint256 id) external nonReentrant {
        Market storage m = markets[id];
        require(m.resolved, "not resolved");
        require(!claimedBet[id][msg.sender], "claimed");
        claimedBet[id][msg.sender] = true;
        uint256 stake = m.outcome ? betYes[id][msg.sender] : betNo[id][msg.sender];
        require(stake > 0, "nothing to claim");
        uint256 winPool = m.outcome ? m.poolYes : m.poolNo;
        uint256 payout = (stake * (m.poolYes + m.poolNo)) / winPool;
        spendable[msg.sender] += payout;
        emit PredictionClaimed(id, msg.sender, payout);
    }

    function marketsCount() external view returns (uint256) {
        return markets.length;
    }

    function predictionOf(uint256 id, address user) external view returns (uint256 yes, uint256 no) {
        return (betYes[id][user], betNo[id][user]);
    }

    // ---------- views ----------
    function spentTodayOf(address user) external view returns (uint256) {
        if (lastSpendDay[user] != block.timestamp / 1 days) return 0;
        return spentToday[user];
    }
}
