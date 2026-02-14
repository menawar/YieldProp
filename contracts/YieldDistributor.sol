// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./PropertyToken.sol";
import "./interfaces/IPriceManager.sol";

/**
 * @title YieldDistributor
 * @dev Manages rental payment collection and proportional yield distribution to token holders
 * 
 * This contract:
 * - Accepts rental payments in stablecoin
 * - Validates payment amounts against current rental price (when PriceManager linked)
 * - Distributes yields proportionally to all token holders
 * - Tracks distribution history and per-holder yields
 * - Calculates annualized yield metrics
 * 
 * @custom:security-contact See SECURITY.md
 * @notice TRUST MODEL: PROPERTY_MANAGER_ROLE distributes yields, registers holders.
 *         PAYMENT_PROCESSOR_ROLE submits rental payments. DEFAULT_ADMIN_ROLE uses 2-step
 *         transfer with delay. Production: use multisig.
 */
contract YieldDistributor is AccessControlDefaultAdminRules, ReentrancyGuard {
    
    // ============ Roles ============
    
    bytes32 public constant PROPERTY_MANAGER_ROLE = keccak256("PROPERTY_MANAGER_ROLE");
    bytes32 public constant PAYMENT_PROCESSOR_ROLE = keccak256("PAYMENT_PROCESSOR_ROLE");
    
    // ============ Structs ============
    
    struct Distribution {
        uint256 id;
        uint256 totalAmount;
        uint256 amountPerToken;
        uint256 timestamp;
        uint256 recipientCount;
    }
    
    // ============ State Variables ============
    
    PropertyToken public immutable propertyToken;
    IERC20 public immutable stablecoin;
    IPriceManager public immutable priceManager;
    uint256 public immutable propertyValuation;
    uint256 public immutable deploymentTimestamp;
    
    uint256 public distributionPool;
    uint256 public distributionCount;
    uint256 public totalYieldsDistributed;
    
    mapping(uint256 => Distribution) private _distributions;
    mapping(address => uint256) private _holderYields;
    
    // Holder registry for efficient distribution
    address[] private _holderRegistry;
    mapping(address => bool) private _isRegisteredHolder;

    /// @dev Authorized contract (e.g. PropertySale) that can register new holders on purchase
    address public authorizedRegistrar;
    
    // ============ Events ============
    
    event RentalPaymentReceived(
        uint256 amount,
        uint256 timestamp,
        address indexed payer
    );
    
    event YieldsDistributed(
        uint256 indexed distributionId,
        uint256 totalAmount,
        uint256 recipientCount,
        uint256 timestamp
    );
    
    event YieldTransferred(
        address indexed holder,
        uint256 amount,
        uint256 indexed distributionId
    );
    
    event HolderRegistered(address indexed holder);
    event HolderRemoved(address indexed holder);
    
    // ============ Errors ============
    
    error InvalidAddress();
    error InvalidAmount();
    error PaymentBelowRentalPrice(uint256 paid, uint256 expected);
    error DistributionPoolEmpty();
    error NoTokenHolders();
    error NoTokenBalance();
    error TransferFailed();
    error InvalidDistributionId();
    
    // ============ Constructor ============
    
    /**
     * @dev Constructor to initialize the YieldDistributor
     * @param _propertyToken Address of the PropertyToken contract
     * @param _stablecoin Address of the stablecoin contract (USDC/DAI)
     * @param _propertyManager Address of the property manager
     * @param _paymentProcessor Address authorized to submit rental payments
     * @param _priceManager Address of PriceManager for rental validation (address(0) = no validation)
     */
    constructor(
        address _propertyToken,
        address _stablecoin,
        address _propertyManager,
        address _paymentProcessor,
        address _priceManager
    ) AccessControlDefaultAdminRules(2 days, msg.sender) {
        if (_propertyToken == address(0) || _stablecoin == address(0)) {
            revert InvalidAddress();
        }
        if (_propertyManager == address(0) || _paymentProcessor == address(0)) {
            revert InvalidAddress();
        }
        
        propertyToken = PropertyToken(_propertyToken);
        stablecoin = IERC20(_stablecoin);
        priceManager = IPriceManager(_priceManager);
        
        // Get property valuation from PropertyToken
        (, , uint256 valuation, ) = propertyToken.getPropertyDetails();
        propertyValuation = valuation;
        deploymentTimestamp = block.timestamp;
        
        _grantRole(PROPERTY_MANAGER_ROLE, _propertyManager);
        _grantRole(PAYMENT_PROCESSOR_ROLE, _paymentProcessor);
    }
    
    // ============ External Functions ============
    
    /**
     * @dev Receive rental payment and add to distribution pool
     * @param amount Amount of stablecoin to receive
     * @notice When priceManager is set, amount must be >= current rental price
     */
    function receiveRentalPayment(uint256 amount) 
        external 
        onlyRole(PAYMENT_PROCESSOR_ROLE) 
        nonReentrant 
    {
        if (amount == 0) revert InvalidAmount();
        
        if (address(priceManager) != address(0)) {
            uint256 expectedRent = priceManager.getCurrentRentalPrice();
            if (amount < expectedRent) {
                revert PaymentBelowRentalPrice(amount, expectedRent);
            }
        }
        
        // Transfer stablecoin from sender to this contract
        bool success = stablecoin.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();
        
        // Add to distribution pool
        distributionPool += amount;
        
        emit RentalPaymentReceived(amount, block.timestamp, msg.sender);
    }
    
    /**
     * @dev Distribute accumulated yields to all token holders proportionally
     */
    function distributeYields() 
        external 
        onlyRole(PROPERTY_MANAGER_ROLE) 
        nonReentrant 
    {
        if (distributionPool == 0) revert DistributionPoolEmpty();
        
        uint256 totalSupply = propertyToken.totalSupply();
        if (totalSupply == 0) revert NoTokenHolders();
        
        // Get all token holders
        address[] memory holders = _getTokenHolders();
        if (holders.length == 0) revert NoTokenHolders();
        
        uint256 amountToDistribute = distributionPool;
        uint256 amountPerToken = (amountToDistribute * 1e18) / totalSupply;
        
        distributionCount++;
        uint256 distributionId = distributionCount;
        
        // Record distribution
        _distributions[distributionId] = Distribution({
            id: distributionId,
            totalAmount: amountToDistribute,
            amountPerToken: amountPerToken,
            timestamp: block.timestamp,
            recipientCount: holders.length
        });
        
        // Reset pool before transfers (checks-effects-interactions)
        distributionPool = 0;
        
        // Distribute to each holder
        uint256 totalDistributed = 0;
        for (uint256 i = 0; i < holders.length; i++) {
            address holder = holders[i];
            uint256 balance = propertyToken.balanceOf(holder);
            
            if (balance > 0) {
                uint256 holderShare = (balance * amountPerToken) / 1e18;
                
                if (holderShare > 0) {
                    bool success = stablecoin.transfer(holder, holderShare);
                    if (!success) revert TransferFailed();
                    
                    _holderYields[holder] += holderShare;
                    totalDistributed += holderShare;
                    
                    emit YieldTransferred(holder, holderShare, distributionId);
                }
            }
        }
        
        totalYieldsDistributed += totalDistributed;
        
        emit YieldsDistributed(distributionId, totalDistributed, holders.length, block.timestamp);
    }
    
    /**
     * @dev Register a token holder for yield distribution
     * @param holder Address to register
     */
    function registerHolder(address holder) 
        external 
        onlyRole(PROPERTY_MANAGER_ROLE) 
    {
        if (holder == address(0)) revert InvalidAddress();
        if (_isRegisteredHolder[holder]) return; // Already registered
        
        _holderRegistry.push(holder);
        _isRegisteredHolder[holder] = true;
        
        emit HolderRegistered(holder);
    }
    
    /**
     * @dev Register multiple holders at once
     * @param holders Array of addresses to register
     */
    function registerHolders(address[] calldata holders) 
        external 
        onlyRole(PROPERTY_MANAGER_ROLE) 
    {
        for (uint256 i = 0; i < holders.length; i++) {
            if (holders[i] != address(0) && !_isRegisteredHolder[holders[i]]) {
                _holderRegistry.push(holders[i]);
                _isRegisteredHolder[holders[i]] = true;
                emit HolderRegistered(holders[i]);
            }
        }
    }
    
    /**
     * @dev Register a new holder when they purchase tokens via PropertySale
     * @param holder Address that just received tokens
     * @notice Only callable by the authorized PropertySale contract
     */
    function registerHolderFromPropertySale(address holder) external {
        if (authorizedRegistrar == address(0)) return; // Not configured
        if (msg.sender != authorizedRegistrar) revert InvalidAddress(); // Caller not authorized
        if (holder == address(0)) revert InvalidAddress();
        if (_isRegisteredHolder[holder]) return;

        _holderRegistry.push(holder);
        _isRegisteredHolder[holder] = true;
        emit HolderRegistered(holder);
    }

    /**
     * @dev Set the PropertySale address authorized to auto-register buyers
     * @param _registrar PropertySale contract address (or address(0) to disable)
     */
    function setAuthorizedRegistrar(address _registrar) external onlyRole(DEFAULT_ADMIN_ROLE) {
        authorizedRegistrar = _registrar;
    }

    /**
     * @dev Self-register as a yield recipient when holding tokens
     * @notice Call this after receiving PropertyTokens (e.g. via transfer) to ensure
     *          you receive yield distributions. Anyone with a positive balance can register.
     */
    function registerHolderForSelf() external {
        if (propertyToken.balanceOf(msg.sender) == 0) revert NoTokenBalance();
        if (_isRegisteredHolder[msg.sender]) return;
        
        _holderRegistry.push(msg.sender);
        _isRegisteredHolder[msg.sender] = true;
        
        emit HolderRegistered(msg.sender);
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Get distribution pool balance
     * @return Current amount in distribution pool
     */
    function getDistributionPool() external view returns (uint256) {
        return distributionPool;
    }
    
    /**
     * @dev Get complete distribution history
     * @return Array of all distributions
     */
    function getDistributionHistory() external view returns (Distribution[] memory) {
        Distribution[] memory history = new Distribution[](distributionCount);
        
        for (uint256 i = 0; i < distributionCount; i++) {
            history[i] = _distributions[i + 1];
        }
        
        return history;
    }
    
    /**
     * @dev Get specific distribution by ID
     * @param id Distribution ID
     * @return Distribution details
     */
    function getDistribution(uint256 id) external view returns (Distribution memory) {
        if (id == 0 || id > distributionCount) revert InvalidDistributionId();
        return _distributions[id];
    }
    
    /**
     * @dev Get total yields distributed across all distributions
     * @return Total amount distributed
     */
    function getTotalYieldsDistributed() external view returns (uint256) {
        return totalYieldsDistributed;
    }
    
    /**
     * @dev Get total yields earned by a specific holder
     * @param holder Address of the token holder
     * @return Total yields earned by holder
     */
    function getHolderYields(address holder) external view returns (uint256) {
        return _holderYields[holder];
    }
    
    /**
     * @dev Calculate annualized yield percentage
     * @return Annualized yield as basis points (1% = 100)
     */
    function getAnnualizedYield() external view returns (uint256) {
        if (totalYieldsDistributed == 0 || propertyValuation == 0) {
            return 0;
        }
        
        uint256 daysSinceDeployment = (block.timestamp - deploymentTimestamp) / 1 days;
        if (daysSinceDeployment == 0) {
            return 0;
        }
        
        // Calculate: (totalYields / valuation) * (365 / days) * 10000 (for basis points)
        // Scale totalYields to match valuation decimals (ether = 1e18, USDC = 1e6)
        // totalYields is in USDC (1e6), valuation is in ether (1e18)
        // Scale totalYields by 1e12 to match: totalYields * 1e12 / valuation
        // Then multiply by 365 * 10000 / days
        uint256 scaledYields = totalYieldsDistributed * 1e12; // Scale USDC to ether
        uint256 annualizedYield = (scaledYields * 365 * 10000) / (propertyValuation * daysSinceDeployment);
        
        return annualizedYield;
    }
    
    /**
     * @dev Get yields distributed within a specific time period
     * @param startTime Start timestamp
     * @param endTime End timestamp
     * @return Total yields distributed in period
     */
    function getYieldsInPeriod(uint256 startTime, uint256 endTime) 
        external 
        view 
        returns (uint256) 
    {
        uint256 totalInPeriod = 0;
        
        for (uint256 i = 1; i <= distributionCount; i++) {
            Distribution memory dist = _distributions[i];
            if (dist.timestamp >= startTime && dist.timestamp <= endTime) {
                totalInPeriod += dist.totalAmount;
            }
        }
        
        return totalInPeriod;
    }
    
    /**
     * @dev Get number of distributions
     * @return Total distribution count
     */
    function getDistributionCount() external view returns (uint256) {
        return distributionCount;
    }
    
    /**
     * @dev Get all registered holders
     * @return Array of registered holder addresses
     */
    function getRegisteredHolders() external view returns (address[] memory) {
        return _holderRegistry;
    }
    
    /**
     * @dev Check if an address is a registered holder
     * @param holder Address to check
     * @return True if registered
     */
    function isRegisteredHolder(address holder) external view returns (bool) {
        return _isRegisteredHolder[holder];
    }
    
    // ============ Internal Functions ============
    
    /**
     * @dev Get all addresses that hold tokens
     * @return Array of token holder addresses
     */
    function _getTokenHolders() internal view returns (address[] memory) {
        // Use the holder registry for efficient distribution
        return _holderRegistry;
    }
}
