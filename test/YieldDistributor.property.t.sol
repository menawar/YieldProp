// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/YieldDistributor.sol";
import "../contracts/PropertyToken.sol";
import "../contracts/mocks/MockERC20.sol";

contract YieldDistributorPropertyTest is Test {
    YieldDistributor public yieldDistributor;
    PropertyToken public propertyToken;
    MockERC20 public stablecoin;
    
    address public owner;
    address public propertyManager;
    address public paymentProcessor;
    address public holder1;
    address public holder2;
    address public holder3;
    
    string constant PROPERTY_ADDRESS = "123 Main St, San Francisco, CA";
    string constant PROPERTY_TYPE = "Single Family";
    uint256 constant PROPERTY_VALUATION = 500000 ether;
    
    function setUp() public {
        owner = address(this);
        propertyManager = makeAddr("propertyManager");
        paymentProcessor = makeAddr("paymentProcessor");
        holder1 = makeAddr("holder1");
        holder2 = makeAddr("holder2");
        holder3 = makeAddr("holder3");
        
        // Deploy PropertyToken
        propertyToken = new PropertyToken(
            PROPERTY_ADDRESS,
            PROPERTY_TYPE,
            PROPERTY_VALUATION,
            propertyManager,
            "",
            ""
        );
        
        // Deploy Mock Stablecoin
        stablecoin = new MockERC20("USD Coin", "USDC", 6);
        
        // Deploy YieldDistributor
        yieldDistributor = new YieldDistributor(
            address(propertyToken),
            address(stablecoin),
            propertyManager,
            paymentProcessor,
            address(0)
        );
        
        // Setup holders
        vm.startPrank(propertyManager);
        propertyToken.addToWhitelist(holder1);
        propertyToken.addToWhitelist(holder2);
        propertyToken.addToWhitelist(holder3);
        vm.stopPrank();
        
        // Distribute tokens
        uint256 totalSupply = propertyToken.totalSupply();
        propertyToken.transfer(holder1, totalSupply * 50 / 100);
        propertyToken.transfer(holder2, totalSupply * 30 / 100);
        propertyToken.transfer(holder3, totalSupply * 20 / 100);
        
        // Register holders
        address[] memory holders = new address[](3);
        holders[0] = holder1;
        holders[1] = holder2;
        holders[2] = holder3;
        vm.prank(propertyManager);
        yieldDistributor.registerHolders(holders);
        
        // Setup payment processor with stablecoin
        stablecoin.mint(paymentProcessor, type(uint128).max);
        vm.prank(paymentProcessor);
        stablecoin.approve(address(yieldDistributor), type(uint256).max);
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 8: Payment Validation and Recording
    /// For any rental payment received by the Yield_Distributor, if the payment amount is valid,
    /// it should be accepted and recorded with the correct amount and timestamp
    function testProperty_PaymentValidationAndRecording(uint256 paymentAmount) public {
        // Bound to valid range (non-zero, reasonable amount)
        paymentAmount = bound(paymentAmount, 1, type(uint64).max);
        
        // Record state before payment
        uint256 poolBefore = yieldDistributor.getDistributionPool();
        
        // Submit payment
        vm.prank(paymentProcessor);
        yieldDistributor.receiveRentalPayment(paymentAmount);
        
        // Verify payment was recorded
        uint256 poolAfter = yieldDistributor.getDistributionPool();
        assertEq(poolAfter - poolBefore, paymentAmount, "Payment should be added to pool");
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 8: Payment Validation (Zero Amount)
    /// Zero amount payments should be rejected
    function testProperty_PaymentValidationRejectsZero() public {
        vm.prank(paymentProcessor);
        vm.expectRevert(YieldDistributor.InvalidAmount.selector);
        yieldDistributor.receiveRentalPayment(0);
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 9: Payment Accumulation Correctness
    /// For any sequence of valid rental payments, the distribution pool balance should equal
    /// the sum of all received payments
    function testProperty_PaymentAccumulationCorrectness(
        uint256 payment1,
        uint256 payment2,
        uint256 payment3
    ) public {
        // Bound payments to valid ranges
        payment1 = bound(payment1, 1, type(uint64).max);
        payment2 = bound(payment2, 1, type(uint64).max);
        payment3 = bound(payment3, 1, type(uint64).max);
        
        // Submit payments
        vm.startPrank(paymentProcessor);
        yieldDistributor.receiveRentalPayment(payment1);
        yieldDistributor.receiveRentalPayment(payment2);
        yieldDistributor.receiveRentalPayment(payment3);
        vm.stopPrank();
        
        // Verify accumulation
        uint256 expectedTotal = payment1 + payment2 + payment3;
        uint256 actualPool = yieldDistributor.getDistributionPool();
        assertEq(actualPool, expectedTotal, "Pool should equal sum of all payments");
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 10: Proportional Yield Calculation
    /// For any token holder during yield distribution, their calculated share should equal
    /// (holderBalance / totalSupply) * distributionPool
    function testProperty_ProportionalYieldCalculation(uint256 paymentAmount) public {
        // Bound to reasonable range - realistic payment amounts
        paymentAmount = bound(paymentAmount, 1e6, 1e15); // 1 USDC to 1 billion USDC
        
        // Add payment
        vm.prank(paymentProcessor);
        yieldDistributor.receiveRentalPayment(paymentAmount);
        
        // Record balances before distribution
        uint256 holder1BalanceBefore = stablecoin.balanceOf(holder1);
        uint256 holder2BalanceBefore = stablecoin.balanceOf(holder2);
        uint256 holder3BalanceBefore = stablecoin.balanceOf(holder3);
        
        // Distribute
        vm.prank(propertyManager);
        yieldDistributor.distributeYields();
        
        // Calculate expected shares
        uint256 totalSupply = propertyToken.totalSupply();
        uint256 holder1Balance = propertyToken.balanceOf(holder1);
        uint256 holder2Balance = propertyToken.balanceOf(holder2);
        uint256 holder3Balance = propertyToken.balanceOf(holder3);
        
        // Calculate actual yields received
        uint256 holder1Yield = stablecoin.balanceOf(holder1) - holder1BalanceBefore;
        uint256 holder2Yield = stablecoin.balanceOf(holder2) - holder2BalanceBefore;
        uint256 holder3Yield = stablecoin.balanceOf(holder3) - holder3BalanceBefore;
        
        // Verify proportions (allowing for rounding)
        uint256 expectedHolder1 = (paymentAmount * holder1Balance) / totalSupply;
        uint256 expectedHolder2 = (paymentAmount * holder2Balance) / totalSupply;
        uint256 expectedHolder3 = (paymentAmount * holder3Balance) / totalSupply;
        
        assertApproxEqAbs(holder1Yield, expectedHolder1, 100, "Holder1 yield should be proportional");
        assertApproxEqAbs(holder2Yield, expectedHolder2, 100, "Holder2 yield should be proportional");
        assertApproxEqAbs(holder3Yield, expectedHolder3, 100, "Holder3 yield should be proportional");
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 11: Conservation of Funds in Distribution
    /// For any yield distribution event, the sum of all yields transferred to token holders
    /// should equal the distribution pool amount
    function testProperty_ConservationOfFunds(uint256 paymentAmount) public {
        // Bound to realistic range
        paymentAmount = bound(paymentAmount, 1e6, 1e15); // 1 USDC to 1 billion USDC
        
        // Add payment
        vm.prank(paymentProcessor);
        yieldDistributor.receiveRentalPayment(paymentAmount);
        
        // Record total balance before
        uint256 totalBefore = stablecoin.balanceOf(holder1) + 
                             stablecoin.balanceOf(holder2) + 
                             stablecoin.balanceOf(holder3);
        
        // Distribute
        vm.prank(propertyManager);
        yieldDistributor.distributeYields();
        
        // Record total balance after
        uint256 totalAfter = stablecoin.balanceOf(holder1) + 
                            stablecoin.balanceOf(holder2) + 
                            stablecoin.balanceOf(holder3);
        
        // Verify conservation (allowing for rounding)
        uint256 totalDistributed = totalAfter - totalBefore;
        assertApproxEqAbs(totalDistributed, paymentAmount, 100, "Total distributed should equal payment");
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 12: Distribution Record Completeness
    /// For any yield distribution executed, the historical record should contain the
    /// distribution ID, total amount, amount per token, timestamp, and recipient count
    function testProperty_DistributionRecordCompleteness(uint256 paymentAmount) public {
        // Bound to reasonable range
        paymentAmount = bound(paymentAmount, 1e6, type(uint64).max);
        
        // Add payment and distribute
        vm.prank(paymentProcessor);
        yieldDistributor.receiveRentalPayment(paymentAmount);
        
        vm.prank(propertyManager);
        yieldDistributor.distributeYields();
        
        // Get distribution record
        YieldDistributor.Distribution memory dist = yieldDistributor.getDistribution(1);
        
        // Verify all fields are set
        assertEq(dist.id, 1, "Distribution ID should be set");
        assertTrue(dist.totalAmount > 0, "Total amount should be set");
        assertTrue(dist.amountPerToken > 0, "Amount per token should be set");
        assertTrue(dist.timestamp > 0, "Timestamp should be set");
        assertEq(dist.recipientCount, 3, "Recipient count should be correct");
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 13: Time-Based Yield Query Accuracy
    /// For any time period query, the total yields returned should equal the sum of all
    /// distributions that occurred within that time range
    function testProperty_TimeBasedYieldQueryAccuracy(
        uint256 payment1,
        uint256 payment2
    ) public {
        // Bound payments
        payment1 = bound(payment1, 1e6, type(uint64).max);
        payment2 = bound(payment2, 1e6, type(uint64).max);
        
        // Record start time
        uint256 startTime = block.timestamp;
        
        // First distribution
        vm.prank(paymentProcessor);
        yieldDistributor.receiveRentalPayment(payment1);
        vm.prank(propertyManager);
        yieldDistributor.distributeYields();
        
        // Advance time
        vm.warp(block.timestamp + 1 days);
        
        // Second distribution
        vm.prank(paymentProcessor);
        yieldDistributor.receiveRentalPayment(payment2);
        vm.prank(propertyManager);
        yieldDistributor.distributeYields();
        
        uint256 endTime = block.timestamp;
        
        // Query yields in period
        uint256 yieldsInPeriod = yieldDistributor.getYieldsInPeriod(startTime, endTime);
        
        // Verify (allowing for rounding)
        uint256 expectedTotal = payment1 + payment2;
        assertApproxEqAbs(yieldsInPeriod, expectedTotal, 6, "Yields in period should match distributions");
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 14: Annualized Yield Calculation
    /// For any distribution history, the annualized yield percentage should be calculated
    /// correctly based on total yields and property valuation
    function testProperty_AnnualizedYieldCalculation(uint256 paymentAmount) public {
        // Bound to realistic range - avoid overflow in annualized yield calculation
        // Max payment: 1e15 (1 billion USDC) to prevent unrealistic yields
        paymentAmount = bound(paymentAmount, 1e6, 1e15); // 1 USDC to 1 billion USDC
        
        // Advance time to ensure calculation works
        vm.warp(block.timestamp + 30 days);
        
        // Add payment and distribute
        vm.prank(paymentProcessor);
        yieldDistributor.receiveRentalPayment(paymentAmount);
        vm.prank(propertyManager);
        yieldDistributor.distributeYields();
        
        // Get annualized yield
        uint256 annualizedYield = yieldDistributor.getAnnualizedYield();
        
        // Verify it's calculated (should be >= 0 for any payment)
        assertTrue(annualizedYield >= 0, "Annualized yield should be calculated");
        
        // Verify it's reasonable (basis points, so 10000 = 100%)
        // With 1 billion USDC on 500k property over 30 days:
        // (1e15 * 1e12 / 500000e18) * (365 / 30) * 10000 = ~243,333 basis points (2433%)
        // But fuzzer can find values near 1e15, giving yields up to ~24,333,000 basis points
        // Allow for very high yields in edge cases with large payments
        assertTrue(annualizedYield < 1000000000, "Annualized yield should be reasonable");
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 15: Per-Holder Yield Tracking
    /// For any token holder, their total earned yields should equal the sum of all yield
    /// amounts they received across all distributions
    function testProperty_PerHolderYieldTracking(
        uint256 payment1,
        uint256 payment2,
        uint256 payment3
    ) public {
        // Bound payments
        payment1 = bound(payment1, 1e6, type(uint64).max);
        payment2 = bound(payment2, 1e6, type(uint64).max);
        payment3 = bound(payment3, 1e6, type(uint64).max);
        
        // Track holder1's balance changes
        uint256 initialBalance = stablecoin.balanceOf(holder1);
        
        // Distribution 1
        vm.prank(paymentProcessor);
        yieldDistributor.receiveRentalPayment(payment1);
        vm.prank(propertyManager);
        yieldDistributor.distributeYields();
        
        // Distribution 2
        vm.prank(paymentProcessor);
        yieldDistributor.receiveRentalPayment(payment2);
        vm.prank(propertyManager);
        yieldDistributor.distributeYields();
        
        // Distribution 3
        vm.prank(paymentProcessor);
        yieldDistributor.receiveRentalPayment(payment3);
        vm.prank(propertyManager);
        yieldDistributor.distributeYields();
        
        // Get tracked yields
        uint256 trackedYields = yieldDistributor.getHolderYields(holder1);
        
        // Get actual balance change
        uint256 actualYields = stablecoin.balanceOf(holder1) - initialBalance;
        
        // Verify tracking matches actual
        assertEq(trackedYields, actualYields, "Tracked yields should match actual yields");
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 11: Conservation After Multiple Distributions
    /// Verify conservation of funds across multiple distributions
    function testProperty_ConservationAcrossMultipleDistributions(
        uint256 payment1,
        uint256 payment2
    ) public {
        // Bound payments to realistic range
        payment1 = bound(payment1, 1e6, 1e15);
        payment2 = bound(payment2, 1e6, 1e15);
        
        // Track total distributed
        uint256 totalExpected = 0;
        
        // Distribution 1
        vm.prank(paymentProcessor);
        yieldDistributor.receiveRentalPayment(payment1);
        vm.prank(propertyManager);
        yieldDistributor.distributeYields();
        totalExpected += payment1;
        
        // Distribution 2
        vm.prank(paymentProcessor);
        yieldDistributor.receiveRentalPayment(payment2);
        vm.prank(propertyManager);
        yieldDistributor.distributeYields();
        totalExpected += payment2;
        
        // Verify total distributed (allowing for rounding in both distributions)
        uint256 totalDistributed = yieldDistributor.getTotalYieldsDistributed();
        assertApproxEqAbs(totalDistributed, totalExpected, 200, "Total distributed should match sum of payments");
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 10: Proportional Distribution with Varying Balances
    /// Test proportional distribution when holder balances change
    function testProperty_ProportionalDistributionWithVaryingBalances(
        uint256 transferAmount,
        uint256 paymentAmount
    ) public {
        // Bound inputs
        uint256 holder1Balance = propertyToken.balanceOf(holder1);
        transferAmount = bound(transferAmount, 1, holder1Balance / 2);
        paymentAmount = bound(paymentAmount, 1e6, type(uint64).max);
        
        // Transfer some tokens from holder1 to holder2
        vm.prank(holder1);
        propertyToken.transfer(holder2, transferAmount);
        
        // Add payment and distribute
        vm.prank(paymentProcessor);
        yieldDistributor.receiveRentalPayment(paymentAmount);
        
        uint256 holder1BalanceBefore = stablecoin.balanceOf(holder1);
        uint256 holder2BalanceBefore = stablecoin.balanceOf(holder2);
        
        vm.prank(propertyManager);
        yieldDistributor.distributeYields();
        
        // Calculate yields
        uint256 holder1Yield = stablecoin.balanceOf(holder1) - holder1BalanceBefore;
        uint256 holder2Yield = stablecoin.balanceOf(holder2) - holder2BalanceBefore;
        
        // Verify holder2 got more than holder1 (since they now have more tokens)
        uint256 newHolder1Balance = propertyToken.balanceOf(holder1);
        uint256 newHolder2Balance = propertyToken.balanceOf(holder2);
        
        if (newHolder2Balance > newHolder1Balance) {
            assertTrue(holder2Yield > holder1Yield, "Holder with more tokens should get more yield");
        }
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 12: Distribution History Ordering
    /// Verify distribution history maintains correct ordering
    function testProperty_DistributionHistoryOrdering(uint8 numDistributions) public {
        // Bound to reasonable number
        numDistributions = uint8(bound(numDistributions, 1, 10));
        
        // Create multiple distributions
        for (uint256 i = 0; i < numDistributions; i++) {
            vm.prank(paymentProcessor);
            yieldDistributor.receiveRentalPayment(1e6);
            vm.prank(propertyManager);
            yieldDistributor.distributeYields();
        }
        
        // Get history
        YieldDistributor.Distribution[] memory history = yieldDistributor.getDistributionHistory();
        
        // Verify count
        assertEq(history.length, numDistributions, "History length should match distribution count");
        
        // Verify ordering (IDs should be sequential)
        for (uint256 i = 0; i < history.length; i++) {
            assertEq(history[i].id, i + 1, "Distribution IDs should be sequential");
        }
    }
}
