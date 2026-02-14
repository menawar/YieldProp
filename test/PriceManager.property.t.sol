// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/PriceManager.sol";

contract PriceManagerPropertyTest is Test {
    PriceManager public priceManager;
    
    address public owner;
    address public propertyManager;
    address public unauthorized;
    
    uint256 constant INITIAL_PRICE = 2000e6; // $2000 USDC (6 decimals)
    
    bytes32 public constant PROPERTY_MANAGER_ROLE = keccak256("PROPERTY_MANAGER_ROLE");
    
    function setUp() public {
        owner = address(this);
        propertyManager = makeAddr("propertyManager");
        unauthorized = makeAddr("unauthorized");
        
        priceManager = new PriceManager(
            INITIAL_PRICE,
            propertyManager
        );
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 6: Recommendation Storage Integrity
    /// For any price recommendation submitted to the smart contract, retrieving the 
    /// recommendation by ID should return the exact same data (price, confidence, 
    /// reasoning, timestamp), ensuring data integrity.
    function testProperty_RecommendationStorageIntegrity(
        uint256 price,
        uint256 confidence,
        string memory reasoning
    ) public {
        // Bound inputs to valid ranges
        price = bound(price, 1, type(uint128).max); // Non-zero, reasonable price
        confidence = bound(confidence, 0, 100); // Valid confidence range
        
        // Ensure reasoning is not empty and within contract limit
        vm.assume(bytes(reasoning).length > 0);
        vm.assume(bytes(reasoning).length <= 512); // MAX_REASONING_LENGTH
        
        // Submit recommendation as CRE workflow
        vm.prank(propertyManager);
        priceManager.submitRecommendation(price, confidence, reasoning);
        
        // Retrieve the recommendation
        PriceManager.PriceRecommendation memory rec = priceManager.getRecommendation(1);
        
        // Assert all fields match exactly
        assertEq(rec.id, 1, "ID should be 1");
        assertEq(rec.recommendedPrice, price, "Price should match submitted value");
        assertEq(rec.confidenceScore, confidence, "Confidence should match submitted value");
        assertEq(rec.reasoning, reasoning, "Reasoning should match submitted value");
        assertEq(rec.submitter, propertyManager, "Submitter should be CRE workflow");
        assertFalse(rec.accepted, "Should not be accepted initially");
        assertFalse(rec.rejected, "Should not be rejected initially");
        assertTrue(rec.timestamp > 0, "Timestamp should be set");
        assertTrue(rec.timestamp <= block.timestamp, "Timestamp should not be in future");
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 6: Recommendation Storage Integrity (Multiple Submissions)
    /// Test that multiple recommendations maintain data integrity independently
    function testProperty_MultipleRecommendationStorageIntegrity(
        uint256 price1,
        uint256 price2,
        uint256 confidence1,
        uint256 confidence2
    ) public {
        // Bound inputs
        price1 = bound(price1, 1, type(uint64).max);
        price2 = bound(price2, 1, type(uint64).max);
        confidence1 = bound(confidence1, 0, 100);
        confidence2 = bound(confidence2, 0, 100);
        
        string memory reasoning1 = "First recommendation reasoning";
        string memory reasoning2 = "Second recommendation reasoning";
        
        // Submit first recommendation
        vm.prank(propertyManager);
        priceManager.submitRecommendation(price1, confidence1, reasoning1);
        
        // Submit second recommendation
        vm.prank(propertyManager);
        priceManager.submitRecommendation(price2, confidence2, reasoning2);
        
        // Retrieve both recommendations
        PriceManager.PriceRecommendation memory rec1 = priceManager.getRecommendation(1);
        PriceManager.PriceRecommendation memory rec2 = priceManager.getRecommendation(2);
        
        // Assert first recommendation integrity
        assertEq(rec1.id, 1);
        assertEq(rec1.recommendedPrice, price1);
        assertEq(rec1.confidenceScore, confidence1);
        assertEq(rec1.reasoning, reasoning1);
        
        // Assert second recommendation integrity
        assertEq(rec2.id, 2);
        assertEq(rec2.recommendedPrice, price2);
        assertEq(rec2.confidenceScore, confidence2);
        assertEq(rec2.reasoning, reasoning2);
        
        // Ensure they are independent
        assertTrue(rec1.id != rec2.id);
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 7: Price Update on Acceptance
    /// For any price recommendation that is accepted by the Property_Manager, the current 
    /// rental price should be updated to match the recommended price, ensuring 
    /// recommendations are applied correctly.
    function testProperty_PriceUpdateOnAcceptance(
        uint256 recommendedPrice,
        uint256 confidence
    ) public {
        // Bound inputs to valid ranges
        recommendedPrice = bound(recommendedPrice, 1, type(uint128).max);
        confidence = bound(confidence, 0, 100);
        
        string memory reasoning = "Market analysis shows price adjustment needed";
        
        // Record initial price
        uint256 initialPrice = priceManager.getCurrentRentalPrice();
        
        // Submit recommendation
        vm.prank(propertyManager);
        priceManager.submitRecommendation(recommendedPrice, confidence, reasoning);
        
        // Price should not change yet
        assertEq(
            priceManager.getCurrentRentalPrice(),
            initialPrice,
            "Price should not change before acceptance"
        );
        
        // Accept recommendation
        vm.prank(propertyManager);
        priceManager.acceptRecommendation(1);
        
        // Price should now match recommended price
        assertEq(
            priceManager.getCurrentRentalPrice(),
            recommendedPrice,
            "Price should match recommended price after acceptance"
        );
        
        // Verify recommendation is marked as accepted
        PriceManager.PriceRecommendation memory rec = priceManager.getRecommendation(1);
        assertTrue(rec.accepted, "Recommendation should be marked as accepted");
        assertFalse(rec.rejected, "Recommendation should not be marked as rejected");
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 7: Price Update on Acceptance (Sequential)
    /// Test that sequential acceptances update price correctly
    function testProperty_SequentialPriceUpdates(
        uint256 price1,
        uint256 price2,
        uint256 price3
    ) public {
        // Bound inputs
        price1 = bound(price1, 1, type(uint64).max);
        price2 = bound(price2, 1, type(uint64).max);
        price3 = bound(price3, 1, type(uint64).max);
        
        string memory reasoning = "Price adjustment";
        
        // Submit and accept first recommendation
        vm.prank(propertyManager);
        priceManager.submitRecommendation(price1, 85, reasoning);
        vm.prank(propertyManager);
        priceManager.acceptRecommendation(1);
        assertEq(priceManager.getCurrentRentalPrice(), price1);
        
        // Submit and accept second recommendation
        vm.prank(propertyManager);
        priceManager.submitRecommendation(price2, 90, reasoning);
        vm.prank(propertyManager);
        priceManager.acceptRecommendation(2);
        assertEq(priceManager.getCurrentRentalPrice(), price2);
        
        // Submit and accept third recommendation
        vm.prank(propertyManager);
        priceManager.submitRecommendation(price3, 95, reasoning);
        vm.prank(propertyManager);
        priceManager.acceptRecommendation(3);
        assertEq(priceManager.getCurrentRentalPrice(), price3);
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 7: Price Does Not Update on Rejection
    /// Verify that rejecting a recommendation does not change the current price
    function testProperty_PriceDoesNotUpdateOnRejection(
        uint256 recommendedPrice,
        uint256 confidence
    ) public {
        // Bound inputs
        recommendedPrice = bound(recommendedPrice, 1, type(uint128).max);
        confidence = bound(confidence, 0, 100);
        
        string memory reasoning = "Market analysis";
        
        // Record initial price
        uint256 initialPrice = priceManager.getCurrentRentalPrice();
        
        // Submit recommendation
        vm.prank(propertyManager);
        priceManager.submitRecommendation(recommendedPrice, confidence, reasoning);
        
        // Reject recommendation
        vm.prank(propertyManager);
        priceManager.rejectRecommendation(1);
        
        // Price should remain unchanged
        assertEq(
            priceManager.getCurrentRentalPrice(),
            initialPrice,
            "Price should not change after rejection"
        );
        
        // Verify recommendation is marked as rejected
        PriceManager.PriceRecommendation memory rec = priceManager.getRecommendation(1);
        assertFalse(rec.accepted, "Recommendation should not be marked as accepted");
        assertTrue(rec.rejected, "Recommendation should be marked as rejected");
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 6: Recommendation History Completeness
    /// Verify that all submitted recommendations appear in history
    function testProperty_RecommendationHistoryCompleteness(uint8 numRecommendations) public {
        // Bound to reasonable number
        numRecommendations = uint8(bound(numRecommendations, 1, 20));
        
        string memory reasoning = "Market analysis";
        
        // Submit multiple recommendations
        for (uint256 i = 0; i < numRecommendations; i++) {
            uint256 price = 2000e6 + (i * 100e6); // Increment price each time
            vm.prank(propertyManager);
            priceManager.submitRecommendation(price, 85, reasoning);
        }
        
        // Get history
        PriceManager.PriceRecommendation[] memory history = priceManager.getRecommendationHistory();
        
        // Verify count matches
        assertEq(
            history.length,
            numRecommendations,
            "History length should match number of submissions"
        );
        
        // Verify each recommendation is present and has correct ID
        for (uint256 i = 0; i < numRecommendations; i++) {
            assertEq(history[i].id, i + 1, "Recommendation ID should be sequential");
            assertEq(
                history[i].recommendedPrice,
                2000e6 + (i * 100e6),
                "Price should match submitted value"
            );
        }
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 6: Recommendation Retrieval Consistency
    /// Verify that getting a recommendation by ID returns the same data as in history
    function testProperty_RecommendationRetrievalConsistency(
        uint256 price,
        uint256 confidence
    ) public {
        // Bound inputs
        price = bound(price, 1, type(uint128).max);
        confidence = bound(confidence, 0, 100);
        
        string memory reasoning = "Consistency test";
        
        // Submit recommendation
        vm.prank(propertyManager);
        priceManager.submitRecommendation(price, confidence, reasoning);
        
        // Get recommendation by ID
        PriceManager.PriceRecommendation memory recById = priceManager.getRecommendation(1);
        
        // Get recommendation from history
        PriceManager.PriceRecommendation[] memory history = priceManager.getRecommendationHistory();
        PriceManager.PriceRecommendation memory recFromHistory = history[0];
        
        // Verify they match
        assertEq(recById.id, recFromHistory.id);
        assertEq(recById.recommendedPrice, recFromHistory.recommendedPrice);
        assertEq(recById.confidenceScore, recFromHistory.confidenceScore);
        assertEq(recById.reasoning, recFromHistory.reasoning);
        assertEq(recById.timestamp, recFromHistory.timestamp);
        assertEq(recById.accepted, recFromHistory.accepted);
        assertEq(recById.rejected, recFromHistory.rejected);
        assertEq(recById.submitter, recFromHistory.submitter);
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 7: Accepted Recommendations Tracking
    /// Verify that accepted recommendations are correctly tracked
    function testProperty_AcceptedRecommendationsTracking(
        uint256 price1,
        uint256 price2,
        uint256 price3
    ) public {
        // Bound inputs
        price1 = bound(price1, 1, type(uint64).max);
        price2 = bound(price2, 1, type(uint64).max);
        price3 = bound(price3, 1, type(uint64).max);
        
        string memory reasoning = "Test";
        
        // Submit three recommendations
        vm.startPrank(propertyManager);
        priceManager.submitRecommendation(price1, 85, reasoning);
        priceManager.submitRecommendation(price2, 90, reasoning);
        priceManager.submitRecommendation(price3, 95, reasoning);
        vm.stopPrank();
        
        // Accept first and third, reject second
        vm.startPrank(propertyManager);
        priceManager.acceptRecommendation(1);
        priceManager.rejectRecommendation(2);
        priceManager.acceptRecommendation(3);
        vm.stopPrank();
        
        // Get accepted recommendations
        PriceManager.PriceRecommendation[] memory accepted = priceManager.getAcceptedRecommendations();
        
        // Should have exactly 2 accepted
        assertEq(accepted.length, 2, "Should have 2 accepted recommendations");
        assertEq(accepted[0].id, 1, "First accepted should be ID 1");
        assertEq(accepted[1].id, 3, "Second accepted should be ID 3");
        assertTrue(accepted[0].accepted, "Should be marked as accepted");
        assertTrue(accepted[1].accepted, "Should be marked as accepted");
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 7: Pending Recommendations Tracking
    /// Verify that pending recommendations are correctly tracked
    function testProperty_PendingRecommendationsTracking(uint8 numPending) public {
        // Bound to reasonable number
        numPending = uint8(bound(numPending, 1, 10));
        
        string memory reasoning = "Test";
        
        // Submit recommendations
        for (uint256 i = 0; i < numPending + 2; i++) {
            vm.prank(propertyManager);
            priceManager.submitRecommendation(2000e6 + (i * 100e6), 85, reasoning);
        }
        
        // Accept first, reject second, leave rest pending
        vm.startPrank(propertyManager);
        priceManager.acceptRecommendation(1);
        priceManager.rejectRecommendation(2);
        vm.stopPrank();
        
        // Get pending recommendations
        PriceManager.PriceRecommendation[] memory pending = priceManager.getPendingRecommendations();
        
        // Should have numPending recommendations
        assertEq(pending.length, numPending, "Should have correct number of pending recommendations");
        
        // Verify all are unprocessed
        for (uint256 i = 0; i < pending.length; i++) {
            assertFalse(pending[i].accepted, "Should not be accepted");
            assertFalse(pending[i].rejected, "Should not be rejected");
        }
    }
}
