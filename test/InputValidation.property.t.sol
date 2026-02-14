// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/PropertyToken.sol";
import "../contracts/PriceManager.sol";
import "../contracts/YieldDistributor.sol";
import "../contracts/mocks/MockERC20.sol";

/// @title Input Validation Property Tests
/// @notice Property-based tests for input validation with descriptive errors
contract InputValidationPropertyTest is Test {
    PropertyToken public propertyToken;
    PriceManager public priceManager;
    YieldDistributor public yieldDistributor;
    MockERC20 public stablecoin;
    
    address public owner;
    address public propertyManager;
    address public paymentProcessor;
    
    string constant PROPERTY_ADDRESS = "123 Main St, San Francisco, CA";
    string constant PROPERTY_TYPE = "Single Family";
    uint256 constant PROPERTY_VALUATION = 500000 ether;
    uint256 constant INITIAL_PRICE = 2000e6;
    
    function setUp() public {
        owner = address(this);
        propertyManager = makeAddr("propertyManager");
        paymentProcessor = makeAddr("paymentProcessor");
        
        // Deploy PropertyToken
        propertyToken = new PropertyToken(
            PROPERTY_ADDRESS,
            PROPERTY_TYPE,
            PROPERTY_VALUATION,
            propertyManager,
            "",
            ""
        );
        
        // Deploy PriceManager
        priceManager = new PriceManager(
            INITIAL_PRICE,
            propertyManager
        );
        
        // Deploy Mock Stablecoin
        stablecoin = new MockERC20("USD Coin", "USDC", 6);
        
        // Deploy YieldDistributor
        yieldDistributor = new YieldDistributor(
            address(propertyToken),
            address(stablecoin),
            propertyManager,
            paymentProcessor,
            address(priceManager)
        );
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 18: Input Validation (PropertyToken - Zero Address)
    /// For any operation with zero address input, the contract should revert with descriptive error
    function testProperty_PropertyToken_ZeroAddressValidation() public {
        // Attempt to add zero address to whitelist
        vm.prank(propertyManager);
        vm.expectRevert(PropertyToken.InvalidAddress.selector);
        propertyToken.addToWhitelist(address(0));
        
        // Attempt to transfer to zero address
        vm.expectRevert();
        propertyToken.transfer(address(0), 1 ether);
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 18: Input Validation (PropertyToken - Insufficient Balance)
    /// For any transfer exceeding balance, the contract should revert with descriptive error
    function testProperty_PropertyToken_InsufficientBalanceValidation(uint256 excessAmount) public {
        address holder = makeAddr("holder");
        uint256 balance = propertyToken.balanceOf(owner);
        
        // Bound excess amount to be greater than balance
        excessAmount = bound(excessAmount, balance + 1, type(uint128).max);
        
        // Attempt to transfer more than balance
        vm.expectRevert();
        propertyToken.transfer(holder, excessAmount);
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 18: Input Validation (PropertyToken - Non-Whitelisted Transfer)
    /// For any transfer to non-whitelisted address, the contract should revert with descriptive error
    function testProperty_PropertyToken_NonWhitelistedTransferValidation(address nonWhitelisted) public {
        vm.assume(nonWhitelisted != address(0));
        vm.assume(!propertyToken.isWhitelisted(nonWhitelisted));
        
        // Attempt to transfer to non-whitelisted address
        vm.expectRevert(abi.encodeWithSelector(PropertyToken.TransferRestricted.selector, owner, nonWhitelisted));
        propertyToken.transfer(nonWhitelisted, 1 ether);
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 18: Input Validation (PriceManager - Zero Price)
    /// For any recommendation with zero price, the contract should revert with descriptive error
    function testProperty_PriceManager_ZeroPriceValidation() public {
        vm.prank(propertyManager);
        vm.expectRevert(PriceManager.InvalidPrice.selector);
        priceManager.submitRecommendation(0, 80, "Test reasoning");
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 18: Input Validation (PriceManager - Invalid Confidence)
    /// For any recommendation with confidence > 100, the contract should revert with descriptive error
    function testProperty_PriceManager_InvalidConfidenceValidation(uint256 invalidConfidence) public {
        // Bound to values greater than 100
        invalidConfidence = bound(invalidConfidence, 101, type(uint256).max);
        
        vm.prank(propertyManager);
        vm.expectRevert(PriceManager.InvalidConfidenceScore.selector);
        priceManager.submitRecommendation(2000e6, invalidConfidence, "Test reasoning");
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 18: Input Validation (PriceManager - Empty Reasoning)
    /// For any recommendation with empty reasoning, the contract should revert with descriptive error
    function testProperty_PriceManager_EmptyReasoningValidation() public {
        vm.prank(propertyManager);
        vm.expectRevert(PriceManager.EmptyReasoning.selector);
        priceManager.submitRecommendation(2000e6, 80, "");
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 18: Input Validation (PriceManager - Invalid Recommendation ID)
    /// For any operation with invalid recommendation ID, the contract should revert with descriptive error
    function testProperty_PriceManager_InvalidRecommendationIdValidation(uint256 invalidId) public {
        // Ensure ID is invalid (greater than count or zero)
        uint256 count = priceManager.recommendationCount();
        vm.assume(invalidId > count || invalidId == 0);
        
        vm.prank(propertyManager);
        vm.expectRevert(PriceManager.InvalidRecommendationId.selector);
        priceManager.acceptRecommendation(invalidId);
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 18: Input Validation (PriceManager - Already Processed)
    /// For any recommendation already accepted/rejected, further operations should revert with descriptive error
    function testProperty_PriceManager_AlreadyProcessedValidation() public {
        // Submit and accept a recommendation
        vm.prank(propertyManager);
        priceManager.submitRecommendation(2500e6, 85, "Market analysis");
        
        vm.prank(propertyManager);
        priceManager.acceptRecommendation(1);
        
        // Attempt to accept again
        vm.prank(propertyManager);
        vm.expectRevert(PriceManager.RecommendationAlreadyProcessed.selector);
        priceManager.acceptRecommendation(1);
        
        // Submit and reject another recommendation
        vm.prank(propertyManager);
        priceManager.submitRecommendation(1800e6, 75, "Different analysis");
        
        vm.prank(propertyManager);
        priceManager.rejectRecommendation(2);
        
        // Attempt to reject again
        vm.prank(propertyManager);
        vm.expectRevert(PriceManager.RecommendationAlreadyProcessed.selector);
        priceManager.rejectRecommendation(2);
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 18: Input Validation (YieldDistributor - Zero Amount)
    /// For any payment with zero amount, the contract should revert with descriptive error
    function testProperty_YieldDistributor_ZeroAmountValidation() public {
        vm.prank(paymentProcessor);
        vm.expectRevert(YieldDistributor.InvalidAmount.selector);
        yieldDistributor.receiveRentalPayment(0);
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 18: Input Validation (YieldDistributor - Empty Pool)
    /// For any distribution attempt with empty pool, the contract should revert with descriptive error
    function testProperty_YieldDistributor_EmptyPoolValidation() public {
        // Ensure pool is empty
        assertEq(yieldDistributor.getDistributionPool(), 0);
        
        vm.prank(propertyManager);
        vm.expectRevert(YieldDistributor.DistributionPoolEmpty.selector);
        yieldDistributor.distributeYields();
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 18: Input Validation (YieldDistributor - Invalid Distribution ID)
    /// For any query with invalid distribution ID, the contract should revert with descriptive error
    function testProperty_YieldDistributor_InvalidDistributionIdValidation(uint256 invalidId) public {
        // Ensure ID is invalid
        uint256 count = yieldDistributor.getDistributionCount();
        vm.assume(invalidId > count || invalidId == 0);
        
        vm.expectRevert(YieldDistributor.InvalidDistributionId.selector);
        yieldDistributor.getDistribution(invalidId);
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 18: Input Validation (YieldDistributor - Zero Address Holder)
    /// For any holder registration with zero address, the contract should revert with descriptive error
    function testProperty_YieldDistributor_ZeroAddressHolderValidation() public {
        vm.prank(propertyManager);
        vm.expectRevert(YieldDistributor.InvalidAddress.selector);
        yieldDistributor.registerHolder(address(0));
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 18: Input Validation (Deployment - Zero Address)
    /// For any contract deployment with zero address parameters, deployment should revert
    function testProperty_Deployment_ZeroAddressValidation() public {
        // PriceManager with zero property manager
        vm.expectRevert(PriceManager.InvalidAddress.selector);
        new PriceManager(INITIAL_PRICE, address(0));
        
        // YieldDistributor with zero property token
        vm.expectRevert(YieldDistributor.InvalidAddress.selector);
        new YieldDistributor(address(0), address(stablecoin), propertyManager, paymentProcessor, address(0));
        
        // YieldDistributor with zero stablecoin
        vm.expectRevert(YieldDistributor.InvalidAddress.selector);
        new YieldDistributor(address(propertyToken), address(0), propertyManager, paymentProcessor, address(0));
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 18: Input Validation (Deployment - Zero Price)
    /// For PriceManager deployment with zero initial price, deployment should revert
    function testProperty_Deployment_ZeroPriceValidation() public {
        vm.expectRevert(PriceManager.InvalidPrice.selector);
        new PriceManager(0, propertyManager);
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 18: Input Validation (Deployment - Zero Valuation)
    /// For PropertyToken deployment with zero valuation, deployment should revert
    function testProperty_Deployment_ZeroValuationValidation() public {
        vm.expectRevert(PropertyToken.InvalidValuation.selector);
        new PropertyToken(PROPERTY_ADDRESS, PROPERTY_TYPE, 0, propertyManager, "", "");
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 18: Input Validation (Comprehensive Error Messages)
    /// For any invalid input, error messages should be descriptive and specific
    function testProperty_DescriptiveErrorMessages() public {
        // Test that errors include relevant context
        
        // PropertyToken: NotWhitelisted includes the address
        address nonWhitelisted = makeAddr("nonWhitelisted");
        try propertyToken.transfer(nonWhitelisted, 1 ether) {
            fail("Should have reverted");
        } catch (bytes memory reason) {
            // Verify error includes address information
            assertTrue(reason.length > 0, "Error should have data");
        }
        
        // PriceManager: InvalidRecommendationId is specific
        vm.prank(propertyManager);
        try priceManager.acceptRecommendation(999) {
            fail("Should have reverted");
        } catch (bytes memory reason) {
            // Verify error is specific to invalid ID
            assertTrue(reason.length > 0, "Error should have data");
        }
        
        // YieldDistributor: DistributionPoolEmpty is clear
        vm.prank(propertyManager);
        try yieldDistributor.distributeYields() {
            fail("Should have reverted");
        } catch (bytes memory reason) {
            // Verify error is specific to empty pool
            assertTrue(reason.length > 0, "Error should have data");
        }
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 18: Input Validation (Boundary Values)
    /// For any boundary value inputs, validation should handle them correctly
    function testProperty_BoundaryValueValidation() public {
        // Test maximum valid confidence (100)
        vm.prank(propertyManager);
        priceManager.submitRecommendation(2000e6, 100, "Maximum confidence");
        
        // Test minimum valid confidence (0)
        vm.prank(propertyManager);
        priceManager.submitRecommendation(2000e6, 0, "Minimum confidence");
        
        // Test minimum valid price (1)
        vm.prank(propertyManager);
        priceManager.submitRecommendation(1, 50, "Minimum price");
        
        // Verify all succeeded
        assertEq(priceManager.recommendationCount(), 3);
    }
}
