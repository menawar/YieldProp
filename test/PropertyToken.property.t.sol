// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/PropertyToken.sol";

contract PropertyTokenPropertyTest is Test {
    PropertyToken public propertyToken;
    
    address public owner;
    address public propertyManager;
    address public investor1;
    address public investor2;
    
    string constant PROPERTY_ADDRESS = "123 Main St, San Francisco, CA";
    string constant PROPERTY_TYPE = "Single Family";
    uint256 constant PROPERTY_VALUATION = 500000 ether;
    
    bytes32 constant DEFAULT_PARTITION = bytes32(0);
    
    function setUp() public {
        owner = address(this);
        propertyManager = makeAddr("propertyManager");
        investor1 = makeAddr("investor1");
        investor2 = makeAddr("investor2");
        
        propertyToken = new PropertyToken(
            PROPERTY_ADDRESS,
            PROPERTY_TYPE,
            PROPERTY_VALUATION,
            propertyManager,
            "",
            ""
        );
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 1: Transfer Restriction Enforcement
    function testProperty_TransferRestrictionEnforcement(
        address sender,
        address recipient,
        uint256 amount
    ) public {
        vm.assume(sender != address(0) && recipient != address(0));
        vm.assume(sender != recipient);
        vm.assume(sender != owner); // Sender must not be owner (avoid self-transfer)
        vm.assume(!propertyToken.isWhitelisted(recipient)); // Recipient must not be whitelisted
        amount = bound(amount, 1, 100 ether);
        
        vm.prank(propertyManager);
        propertyToken.addToWhitelist(sender);
        
        if (amount <= propertyToken.balanceOf(owner)) {
            propertyToken.transfer(sender, amount);
        } else {
            return;
        }
        
        vm.prank(sender);
        vm.expectRevert();
        propertyToken.transfer(recipient, amount);
        
        assertEq(propertyToken.balanceOf(sender), amount);
        assertEq(propertyToken.balanceOf(recipient), 0);
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 2: Ownership Percentage Accuracy
    function testProperty_OwnershipPercentageAccuracy(uint256 transferAmount) public {
        transferAmount = bound(transferAmount, 1, 100 ether);
        
        vm.prank(propertyManager);
        propertyToken.addToWhitelist(investor1);
        
        propertyToken.transfer(investor1, transferAmount);
        
        uint256 percentage = propertyToken.getOwnershipPercentage(investor1);
        uint256 totalSupply = propertyToken.totalSupply();
        uint256 expectedPercentage = (transferAmount * 10000) / totalSupply;
        
        assertEq(percentage, expectedPercentage);
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 3: Property Metadata Immutability
    function testProperty_MetadataImmutability(uint256 numTransfers) public {
        numTransfers = bound(numTransfers, 0, 10);
        
        (
            string memory initialAddress,
            string memory initialType,
            uint256 initialValuation,
            uint256 initialTotalTokens
        ) = propertyToken.getPropertyDetails();
        
        vm.prank(propertyManager);
        propertyToken.addToWhitelist(investor1);
        
        uint256 transferAmount = 1 ether;
        for (uint256 i = 0; i < numTransfers; i++) {
            if (propertyToken.balanceOf(owner) >= transferAmount) {
                propertyToken.transfer(investor1, transferAmount);
            }
        }
        
        (
            string memory finalAddress,
            string memory finalType,
            uint256 finalValuation,
            uint256 finalTotalTokens
        ) = propertyToken.getPropertyDetails();
        
        assertEq(keccak256(bytes(finalAddress)), keccak256(bytes(initialAddress)));
        assertEq(keccak256(bytes(finalType)), keccak256(bytes(initialType)));
        assertEq(finalValuation, initialValuation);
        assertEq(finalTotalTokens, initialTotalTokens);
    }
    
    /// @custom:property Feature: yieldprop-mvp, Property 16: Whitelist Management Consistency
    function testProperty_WhitelistManagementConsistency(address addr1, address addr2) public {
        vm.assume(addr1 != address(0) && addr2 != address(0));
        vm.assume(addr1 != addr2);
        vm.assume(addr1 != owner && addr2 != owner);
        
        vm.startPrank(propertyManager);
        propertyToken.addToWhitelist(addr1);
        propertyToken.addToWhitelist(addr2);
        vm.stopPrank();
        
        assertTrue(propertyToken.isWhitelisted(addr1));
        assertTrue(propertyToken.isWhitelisted(addr2));
        
        uint256 amount = 10 ether;
        if (amount <= propertyToken.balanceOf(owner)) {
            propertyToken.transfer(addr1, amount);
            
            vm.prank(addr1);
            propertyToken.transfer(addr2, amount);
            
            assertEq(propertyToken.balanceOf(addr2), amount);
        }
    }
}
