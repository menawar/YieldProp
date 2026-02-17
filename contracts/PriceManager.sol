// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";

/**
 * @title PriceManager
 * @dev Manages AI-generated rental price recommendations for tokenized real estate
 * 
 * This contract:
 * - Receives price recommendations from property manager
 * - Allows property manager to accept/reject recommendations
 * - Maintains historical log of all recommendations
 * - Tracks current rental price
 * - Emits events for all price changes
 * 
 * @custom:security-contact See SECURITY.md
 * @notice TRUST MODEL: PROPERTY_MANAGER_ROLE submits/accepts/rejects recommendations.
 *         DEFAULT_ADMIN_ROLE uses 2-step transfer with delay. Production: use multisig.
 */
contract PriceManager is AccessControlDefaultAdminRules {
    
    // ============ Roles ============
    
    bytes32 public constant PROPERTY_MANAGER_ROLE = keccak256("PROPERTY_MANAGER_ROLE");
    
    // ============ Structs ============
    
    struct PriceRecommendation {
        uint256 id;
        uint256 recommendedPrice;
        uint256 confidenceScore;
        string reasoning;
        uint256 timestamp;
        bool accepted;
        bool rejected;
        address submitter;
    }
    
    // ============ State Variables ============
    
    uint256 public currentRentalPrice;
    uint256 public recommendationCount;
    
    mapping(uint256 => PriceRecommendation) private _recommendations;
    uint256[] private _recommendationIds;
    
    // ============ Events ============
    
    event RecommendationSubmitted(
        uint256 indexed id,
        uint256 price,
        uint256 confidence,
        string reasoning,
        address indexed submitter
    );
    
    event RecommendationAccepted(
        uint256 indexed id,
        uint256 newPrice,
        address indexed acceptedBy
    );
    
    event RecommendationRejected(
        uint256 indexed id,
        address indexed rejectedBy
    );
    
    event RentalPriceUpdated(
        uint256 oldPrice,
        uint256 newPrice
    );
    
    // ============ Constants ============
    
    /// @dev Maximum length for reasoning string (prevents runaway storage costs)
    uint256 public constant MAX_REASONING_LENGTH = 512;

    /// @dev Maximum price deviation from current price (50% = 5000 basis points)
    /// Prevents rogue AI recommendations from setting extreme prices
    uint256 public constant MAX_PRICE_DEVIATION_BPS = 5000;
    
    // ============ Errors ============
    
    error InvalidPrice();
    error InvalidAddress();
    error InvalidConfidenceScore();
    error InvalidRecommendationId();
    error RecommendationAlreadyProcessed();
    error EmptyReasoning();
    error ReasoningTooLong(uint256 length, uint256 max);
    error PriceOutOfBounds(uint256 price, uint256 lowerBound, uint256 upperBound);
    
    // ============ Constructor ============
    
    /**
     * @dev Constructor to initialize the PriceManager
     * @param _initialPrice Initial rental price in stablecoin units (e.g., USDC with 6 decimals)
     * @param _propertyManager Address of the property manager
     */
    constructor(
        uint256 _initialPrice,
        address _propertyManager
    ) AccessControlDefaultAdminRules(2 days, msg.sender) {
        if (_initialPrice == 0) revert InvalidPrice();
        if (_propertyManager == address(0)) revert InvalidAddress();
        
        currentRentalPrice = _initialPrice;
        
        _grantRole(PROPERTY_MANAGER_ROLE, _propertyManager);
        
        emit RentalPriceUpdated(0, _initialPrice);
    }
    
    // ============ External Functions ============
    
    /**
     * @dev Submit a new price recommendation (called by property manager)
     * @param price Recommended rental price
     * @param confidence Confidence score (0-100)
     * @param reasoning AI-generated explanation for the recommendation
     */
    function submitRecommendation(
        uint256 price,
        uint256 confidence,
        string calldata reasoning
    ) external onlyRole(PROPERTY_MANAGER_ROLE) {
        if (price == 0) revert InvalidPrice();
        if (confidence > 100) revert InvalidConfidenceScore();
        if (bytes(reasoning).length == 0) revert EmptyReasoning();
        if (bytes(reasoning).length > MAX_REASONING_LENGTH) {
            revert ReasoningTooLong(bytes(reasoning).length, MAX_REASONING_LENGTH);
        }

        // Price bounds check: reject if deviation > 50% from current price
        // Skip bounds check on the very first recommendation (currentRentalPrice is initial)
        if (currentRentalPrice > 0) {
            uint256 lowerBound = currentRentalPrice * (10000 - MAX_PRICE_DEVIATION_BPS) / 10000;
            uint256 upperBound = currentRentalPrice * (10000 + MAX_PRICE_DEVIATION_BPS) / 10000;
            if (price < lowerBound || price > upperBound) {
                revert PriceOutOfBounds(price, lowerBound, upperBound);
            }
        }
        
        recommendationCount++;
        uint256 newId = recommendationCount;
        
        _recommendations[newId] = PriceRecommendation({
            id: newId,
            recommendedPrice: price,
            confidenceScore: confidence,
            reasoning: reasoning,
            timestamp: block.timestamp,
            accepted: false,
            rejected: false,
            submitter: msg.sender
        });
        
        _recommendationIds.push(newId);
        
        emit RecommendationSubmitted(newId, price, confidence, reasoning, msg.sender);
    }
    
    /**
     * @dev Accept a price recommendation and update current rental price
     * @param recommendationId ID of the recommendation to accept
     */
    function acceptRecommendation(uint256 recommendationId) 
        external 
        onlyRole(PROPERTY_MANAGER_ROLE) 
    {
        if (recommendationId == 0 || recommendationId > recommendationCount) {
            revert InvalidRecommendationId();
        }
        
        PriceRecommendation storage recommendation = _recommendations[recommendationId];
        
        if (recommendation.accepted || recommendation.rejected) {
            revert RecommendationAlreadyProcessed();
        }
        
        recommendation.accepted = true;
        
        uint256 oldPrice = currentRentalPrice;
        currentRentalPrice = recommendation.recommendedPrice;
        
        emit RecommendationAccepted(recommendationId, recommendation.recommendedPrice, msg.sender);
        emit RentalPriceUpdated(oldPrice, recommendation.recommendedPrice);
    }
    
    /**
     * @dev Reject a price recommendation
     * @param recommendationId ID of the recommendation to reject
     */
    function rejectRecommendation(uint256 recommendationId) 
        external 
        onlyRole(PROPERTY_MANAGER_ROLE) 
    {
        if (recommendationId == 0 || recommendationId > recommendationCount) {
            revert InvalidRecommendationId();
        }
        
        PriceRecommendation storage recommendation = _recommendations[recommendationId];
        
        if (recommendation.accepted || recommendation.rejected) {
            revert RecommendationAlreadyProcessed();
        }
        
        recommendation.rejected = true;
        
        emit RecommendationRejected(recommendationId, msg.sender);
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Get current rental price
     * @return Current rental price in stablecoin units
     */
    function getCurrentRentalPrice() external view returns (uint256) {
        return currentRentalPrice;
    }
    
    /**
     * @dev Get a specific recommendation by ID
     * @param id Recommendation ID
     * @return Recommendation details
     */
    function getRecommendation(uint256 id) 
        external 
        view 
        returns (PriceRecommendation memory) 
    {
        if (id == 0 || id > recommendationCount) {
            revert InvalidRecommendationId();
        }
        return _recommendations[id];
    }
    
    /**
     * @dev Get all recommendation IDs
     * @return Array of all recommendation IDs
     */
    function getRecommendationIds() external view returns (uint256[] memory) {
        return _recommendationIds;
    }
    
    /**
     * @dev Get complete recommendation history
     * @return Array of all recommendations
     */
    function getRecommendationHistory() 
        external 
        view 
        returns (PriceRecommendation[] memory) 
    {
        PriceRecommendation[] memory history = new PriceRecommendation[](recommendationCount);
        
        for (uint256 i = 0; i < recommendationCount; i++) {
            history[i] = _recommendations[i + 1];
        }
        
        return history;
    }
    
    /**
     * @dev Get the latest recommendation
     * @return Latest recommendation (or empty struct if none exist)
     */
    function getLatestRecommendation() 
        external 
        view 
        returns (PriceRecommendation memory) 
    {
        if (recommendationCount == 0) {
            return PriceRecommendation({
                id: 0,
                recommendedPrice: 0,
                confidenceScore: 0,
                reasoning: "",
                timestamp: 0,
                accepted: false,
                rejected: false,
                submitter: address(0)
            });
        }
        return _recommendations[recommendationCount];
    }
    
    /**
     * @dev Get pending (unprocessed) recommendations
     * @return Array of pending recommendations
     */
    function getPendingRecommendations() 
        external 
        view 
        returns (PriceRecommendation[] memory) 
    {
        // First, count pending recommendations
        uint256 pendingCount = 0;
        for (uint256 i = 1; i <= recommendationCount; i++) {
            if (!_recommendations[i].accepted && !_recommendations[i].rejected) {
                pendingCount++;
            }
        }
        
        // Create array and populate
        PriceRecommendation[] memory pending = new PriceRecommendation[](pendingCount);
        uint256 index = 0;
        
        for (uint256 i = 1; i <= recommendationCount; i++) {
            if (!_recommendations[i].accepted && !_recommendations[i].rejected) {
                pending[index] = _recommendations[i];
                index++;
            }
        }
        
        return pending;
    }
    
    /**
     * @dev Get accepted recommendations
     * @return Array of accepted recommendations
     */
    function getAcceptedRecommendations() 
        external 
        view 
        returns (PriceRecommendation[] memory) 
    {
        // Count accepted recommendations
        uint256 acceptedCount = 0;
        for (uint256 i = 1; i <= recommendationCount; i++) {
            if (_recommendations[i].accepted) {
                acceptedCount++;
            }
        }
        
        // Create array and populate
        PriceRecommendation[] memory accepted = new PriceRecommendation[](acceptedCount);
        uint256 index = 0;
        
        for (uint256 i = 1; i <= recommendationCount; i++) {
            if (_recommendations[i].accepted) {
                accepted[index] = _recommendations[i];
                index++;
            }
        }
        
        return accepted;
    }
    
    // ============ Paginated View Functions (gas-safe for large datasets) ============
    
    /**
     * @dev Get most recent recommendations (newest first)
     * @param limit Maximum number of recommendations to return
     * @return Array of recommendations, newest first
     * @notice Use this instead of getRecommendationHistory for dashboards to avoid gas exhaustion
     */
    function getRecentRecommendations(uint256 limit) 
        external 
        view 
        returns (PriceRecommendation[] memory) 
    {
        if (recommendationCount == 0) {
            return new PriceRecommendation[](0);
        }
        
        uint256 count = limit > recommendationCount ? recommendationCount : limit;
        PriceRecommendation[] memory recent = new PriceRecommendation[](count);
        
        for (uint256 i = 0; i < count; i++) {
            uint256 id = recommendationCount - i;
            recent[i] = _recommendations[id];
        }
        
        return recent;
    }
    
    /**
     * @dev Get recommendations by pagination (oldest first)
     * @param offset Number of recommendations to skip (0 = start from oldest)
     * @param limit Maximum number to return
     * @return recommendations Slice of recommendations
     * @return totalCount Total recommendation count (for pagination UI)
     */
    function getRecommendationsPaginated(uint256 offset, uint256 limit) 
        external 
        view 
        returns (PriceRecommendation[] memory recommendations, uint256 totalCount) 
    {
        totalCount = recommendationCount;
        if (totalCount == 0 || offset >= totalCount) {
            return (new PriceRecommendation[](0), totalCount);
        }
        
        uint256 end = offset + limit;
        if (end > totalCount) end = totalCount;
        uint256 count = end - offset;
        
        recommendations = new PriceRecommendation[](count);
        for (uint256 i = 0; i < count; i++) {
            recommendations[i] = _recommendations[offset + i + 1];
        }
        
        return (recommendations, totalCount);
    }
    
    /**
     * @dev Get recommendation IDs by pagination
     * @param offset Number of IDs to skip
     * @param limit Maximum number to return
     * @return ids Slice of recommendation IDs
     * @return totalCount Total count
     */
    function getRecommendationIdsPaginated(uint256 offset, uint256 limit) 
        external 
        view 
        returns (uint256[] memory ids, uint256 totalCount) 
    {
        totalCount = recommendationCount;
        if (totalCount == 0 || offset >= totalCount) {
            return (new uint256[](0), totalCount);
        }
        
        uint256 end = offset + limit;
        if (end > totalCount) end = totalCount;
        uint256 count = end - offset;
        
        ids = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            ids[i] = offset + i + 1;
        }
        
        return (ids, totalCount);
    }
}
