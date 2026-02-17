// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./interfaces/IPropertyToken.sol";
import "./interfaces/IYieldDistributor.sol";

/**
 * @title PropertySale
 * @dev Allows whitelisted investors to purchase property tokens with USDC.
 *      Price per token = property valuation / 100 (100 tokens = 100% ownership).
 *      Seller (token holder) must approve this contract to transfer tokens.
 */
contract PropertySale is ReentrancyGuard {
    address public immutable propertyToken;
    address public immutable stablecoin;
    address public immutable propertyManager;
    address public immutable tokenHolder;
    address public immutable yieldDistributor;

    uint256 private constant TOTAL_TOKENS = 100;
    uint256 private constant TOKEN_DECIMALS = 18;
    uint256 private constant STABLECOIN_DECIMALS = 6;

    bool public saleActive = true;
    uint256 public tokensOfferedForSale;

    error SaleNotActive();
    error NotWhitelisted();
    error InsufficientTokenBalance();
    error InvalidAmount();
    error CannotBuyOwnTokens();
    error ExceedsOffering();

    event TokensPurchased(address indexed buyer, uint256 tokenAmount, uint256 usdcAmount);
    event TokensOfferedUpdated(uint256 amount);

    constructor(
        address _propertyToken,
        address _stablecoin,
        address _propertyManager,
        address _tokenHolder,
        address _yieldDistributor
    ) {
        propertyToken = _propertyToken;
        stablecoin = _stablecoin;
        propertyManager = _propertyManager;
        tokenHolder = _tokenHolder;
        yieldDistributor = _yieldDistributor;
    }

    /**
     * @notice Returns price per token in USDC (6 decimals).
     *         pricePerToken = valuation / 100
     */
    function pricePerToken() external view returns (uint256) {
        (, , uint256 valuation, ) = IPropertyToken(propertyToken).getPropertyDetails();
        // valuation in 1e18, convert to USDC 6 decimals for 1 token
        return (valuation / TOTAL_TOKENS) * (10 ** STABLECOIN_DECIMALS) / (10 ** TOKEN_DECIMALS);
    }

    /**
     * @notice Returns USDC cost for given token amount (6 decimals).
     */
    function getCostForTokens(uint256 tokenAmount) external view returns (uint256) {
        uint256 price = this.pricePerToken();
        return (tokenAmount * price) / (10 ** TOKEN_DECIMALS);
    }

    /**
     * @notice Purchase property tokens with USDC.
     * @param tokenAmount Amount of tokens to purchase (18 decimals).
     */
    function invest(uint256 tokenAmount) external nonReentrant {
        if (!saleActive) revert SaleNotActive();
        if (tokenAmount == 0) revert InvalidAmount();
        if (msg.sender == tokenHolder) revert CannotBuyOwnTokens();
        if (!IPropertyToken(propertyToken).isWhitelisted(msg.sender)) revert NotWhitelisted();

        if (tokenAmount > tokensOfferedForSale) revert ExceedsOffering();

        uint256 cost = this.getCostForTokens(tokenAmount);
        uint256 holderBalance = IPropertyToken(propertyToken).balanceOf(tokenHolder);
        if (holderBalance < tokenAmount) revert InsufficientTokenBalance();

        tokensOfferedForSale -= tokenAmount;

        // Pull USDC from buyer to property manager
        require(IERC20(stablecoin).transferFrom(msg.sender, propertyManager, cost), "USDC transfer failed");

        // Transfer tokens from holder to buyer
        require(IPropertyToken(propertyToken).transferFrom(tokenHolder, msg.sender, tokenAmount), "Token transfer failed");

        // Auto-register buyer for yield distribution when YieldDistributor is configured
        if (yieldDistributor != address(0)) {
            IYieldDistributor(yieldDistributor).registerHolderFromPropertySale(msg.sender);
        }

        emit TokensPurchased(msg.sender, tokenAmount, cost);
    }

    function setSaleActive(bool _active) external {
        require(msg.sender == propertyManager, "Only property manager");
        saleActive = _active;
    }



    /**
     * @notice Set how many tokens are offered for sale. Only property manager.
     * @param amount Tokens to offer (18 decimals). Cannot exceed tokenHolder balance.
     */
    function setTokensOfferedForSale(uint256 amount) external {
        require(msg.sender == propertyManager, "Only property manager");
        uint256 holderBalance = IPropertyToken(propertyToken).balanceOf(tokenHolder);
        require(amount <= holderBalance, "Exceeds holder balance");
        tokensOfferedForSale = amount;
        emit TokensOfferedUpdated(amount);
    }
}

