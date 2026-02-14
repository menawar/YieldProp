// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/PropertyToken.sol";
import "../contracts/PriceManager.sol";
import "../contracts/YieldDistributor.sol";
import "../contracts/mocks/MockERC20.sol";

/// @title Access Control Property Tests
/// @notice Property-based tests for access control enforcement across all contracts
contract AccessControlPropertyTest is Test {
    PropertyToken public propertyToken;
    PriceManager public priceManager;
    YieldDistributor public yieldDistributor;
    MockERC20 public stablecoin;
    
    address public owner;
    address public propertyManager;
    address public paymentProcessor;
    address public unauthorizedUser;
    
    string constant PROPERTY_ADDRESS = "123 Main St, San Francisco, CA";
    string constant PROPERTY_TYPE = "Single Family";
    uint256 constant PROPERTY_VALUATION = 500000 ether;
    uint256 constant INITIAL_PRICE = 2000e6; // $2000 USDC
    
    function setUp() public {
        owner = address(this);
        propertyManager = makeAddr("propertyManager");
        paymentProcessor = makeAddr("paymentProcessor");
        unauthorizedUser = makeAddr("unauthorizedUser");
        
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
        
        // Deploy YieldDistributor (address(0) = no payment validation for access control tests)
        yieldDistributor = new YieldDistributor(
            address(propertyToken),
            address(stablecoin),
            propertyManager,
            paymentProcessor,
            address(0)
        );
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 17: Access Control Enforcement (PropertyToken - Whitelist)
    /// For any unauthorized address attempting to modify the whitelist, the transaction should revert
    function testProperty_PropertyToken_WhitelistAccessControl(address randomCaller) public {
        // Ensure random caller is not authorized
        vm.assume(randomCaller != propertyManager);
        vm.assume(randomCaller != owner);
        vm.assume(randomCaller != address(0));
        
        // Attempt to add to whitelist as unauthorized user
        vm.prank(randomCaller);
        vm.expectRevert();
        propertyToken.addToWhitelist(makeAddr("newUser"));
        
        // Attempt to remove from whitelist as unauthorized user
        vm.prank(randomCaller);
        vm.expectRevert();
        propertyToken.removeFromWhitelist(owner);
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 17: Access Control Enforcement (PropertyToken - Issuance)
    /// For any unauthorized address attempting to issue tokens, the transaction should revert
    function testProperty_PropertyToken_IssuanceAccessControl(address randomCaller, uint256 amount) public {
        // Ensure random caller is not authorized
        vm.assume(randomCaller != owner);
        vm.assume(randomCaller != address(0));
        
        // Bound amount to reasonable range
        amount = bound(amount, 1, 100 ether);
        
        // Attempt to issue tokens as unauthorized user
        vm.prank(randomCaller);
        vm.expectRevert();
        propertyToken.issue(randomCaller, amount, "");
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 17: Access Control Enforcement (PropertyToken - Controller)
    /// For any unauthorized address attempting controller operations, the transaction should revert
    function testProperty_PropertyToken_ControllerAccessControl(address randomCaller, uint256 amount) public {
        // Ensure random caller is not authorized
        vm.assume(randomCaller != owner);
        vm.assume(randomCaller != address(0));
        
        // Bound amount to reasonable range
        amount = bound(amount, 1, propertyToken.balanceOf(owner));
        
        // Attempt controller transfer as unauthorized user
        vm.prank(randomCaller);
        vm.expectRevert();
        propertyToken.controllerTransfer(owner, randomCaller, amount, "", "");
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 17: Access Control Enforcement (PriceManager - Submit)
    /// For any unauthorized address attempting to submit recommendations, the transaction should revert
    function testProperty_PriceManager_SubmitAccessControl(address randomCaller, uint256 price) public {
        // Ensure random caller is not property manager
        vm.assume(randomCaller != propertyManager);
        vm.assume(randomCaller != address(0));
        
        // Bound price to reasonable range
        price = bound(price, 1, 10000e6);
        
        // Attempt to submit recommendation as unauthorized user
        vm.prank(randomCaller);
        vm.expectRevert();
        priceManager.submitRecommendation(price, 80, "Test reasoning");
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 17: Access Control Enforcement (PriceManager - Accept)
    /// For any unauthorized address attempting to accept recommendations, the transaction should revert
    function testProperty_PriceManager_AcceptAccessControl(address randomCaller) public {
        // Ensure random caller is not property manager
        vm.assume(randomCaller != propertyManager);
        vm.assume(randomCaller != address(0));
        
        // Submit a recommendation first
        vm.prank(propertyManager);
        priceManager.submitRecommendation(2500e6, 85, "Market analysis suggests increase");
        
        // Attempt to accept recommendation as unauthorized user
        vm.prank(randomCaller);
        vm.expectRevert();
        priceManager.acceptRecommendation(1);
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 17: Access Control Enforcement (PriceManager - Reject)
    /// For any unauthorized address attempting to reject recommendations, the transaction should revert
    function testProperty_PriceManager_RejectAccessControl(address randomCaller) public {
        // Ensure random caller is not property manager
        vm.assume(randomCaller != propertyManager);
        vm.assume(randomCaller != address(0));
        
        // Submit a recommendation first
        vm.prank(propertyManager);
        priceManager.submitRecommendation(2500e6, 85, "Market analysis suggests increase");
        
        // Attempt to reject recommendation as unauthorized user
        vm.prank(randomCaller);
        vm.expectRevert();
        priceManager.rejectRecommendation(1);
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 17: Access Control Enforcement (YieldDistributor - Payment)
    /// For any unauthorized address attempting to receive rental payment, the transaction should revert
    function testProperty_YieldDistributor_PaymentAccessControl(address randomCaller, uint256 amount) public {
        // Ensure random caller is not payment processor
        vm.assume(randomCaller != paymentProcessor);
        vm.assume(randomCaller != address(0));
        
        // Bound amount to reasonable range
        amount = bound(amount, 1, 10000e6);
        
        // Attempt to receive payment as unauthorized user
        vm.prank(randomCaller);
        vm.expectRevert();
        yieldDistributor.receiveRentalPayment(amount);
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 17: Access Control Enforcement (YieldDistributor - Distribution)
    /// For any unauthorized address attempting to distribute yields, the transaction should revert
    function testProperty_YieldDistributor_DistributionAccessControl(address randomCaller) public {
        // Ensure random caller is not property manager
        vm.assume(randomCaller != propertyManager);
        vm.assume(randomCaller != address(0));
        
        // Setup: add some funds to distribution pool
        stablecoin.mint(paymentProcessor, 1000e6);
        vm.prank(paymentProcessor);
        stablecoin.approve(address(yieldDistributor), 1000e6);
        vm.prank(paymentProcessor);
        yieldDistributor.receiveRentalPayment(1000e6);
        
        // Attempt to distribute yields as unauthorized user
        vm.prank(randomCaller);
        vm.expectRevert();
        yieldDistributor.distributeYields();
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 17: Access Control Enforcement (YieldDistributor - Register)
    /// For any unauthorized address attempting to register holders, the transaction should revert
    function testProperty_YieldDistributor_RegisterAccessControl(address randomCaller) public {
        // Ensure random caller is not property manager
        vm.assume(randomCaller != propertyManager);
        vm.assume(randomCaller != address(0));
        
        address[] memory holders = new address[](1);
        holders[0] = makeAddr("newHolder");
        
        // Attempt to register holders as unauthorized user
        vm.prank(randomCaller);
        vm.expectRevert();
        yieldDistributor.registerHolders(holders);
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 17: Access Control Enforcement (Authorized Operations)
    /// For any authorized address, restricted operations should succeed
    function testProperty_AuthorizedOperationsSucceed(uint256 price) public {
        // Bound price to reasonable range
        price = bound(price, 1, 10000e6);
        
        // PropertyToken: Property manager can modify whitelist
        vm.prank(propertyManager);
        propertyToken.addToWhitelist(makeAddr("newUser"));
        assertTrue(propertyToken.isWhitelisted(makeAddr("newUser")));
        
        // PriceManager: Property manager can submit recommendations
        vm.prank(propertyManager);
        priceManager.submitRecommendation(price, 80, "Test reasoning for authorized submission");
        assertEq(priceManager.recommendationCount(), 1);
        
        // PriceManager: Property manager can accept recommendations
        vm.prank(propertyManager);
        priceManager.acceptRecommendation(1);
        assertEq(priceManager.getCurrentRentalPrice(), price);
        
        // YieldDistributor: Payment processor can receive payments
        stablecoin.mint(paymentProcessor, 1000e6);
        vm.prank(paymentProcessor);
        stablecoin.approve(address(yieldDistributor), 1000e6);
        vm.prank(paymentProcessor);
        yieldDistributor.receiveRentalPayment(1000e6);
        assertEq(yieldDistributor.getDistributionPool(), 1000e6);
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 17: Access Control Enforcement (Role Consistency)
    /// For any role assignment, the role should be consistently enforced across all operations
    function testProperty_RoleConsistencyAcrossOperations(address testUser) public {
        vm.assume(testUser != address(0));
        vm.assume(testUser != owner);
        vm.assume(testUser != propertyManager);
        vm.assume(testUser != paymentProcessor);
        
        // Verify testUser cannot perform any restricted operations
        
        // PropertyToken operations
        vm.startPrank(testUser);
        vm.expectRevert();
        propertyToken.addToWhitelist(testUser);
        
        vm.expectRevert();
        propertyToken.issue(testUser, 1 ether, "");
        vm.stopPrank();
        
        // PriceManager operations
        vm.startPrank(testUser);
        vm.expectRevert();
        priceManager.submitRecommendation(2000e6, 80, "Test");
        vm.stopPrank();
        
        // YieldDistributor operations
        vm.startPrank(testUser);
        vm.expectRevert();
        yieldDistributor.receiveRentalPayment(1000e6);
        
        vm.expectRevert();
        yieldDistributor.distributeYields();
        vm.stopPrank();
    }
}
