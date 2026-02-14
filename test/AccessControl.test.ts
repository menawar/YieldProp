import { expect } from "chai";
import { ethers } from "hardhat";
import { PropertyToken, PriceManager, YieldDistributor, MockERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Access Control - Unit Tests", function () {
  let propertyToken: PropertyToken;
  let priceManager: PriceManager;
  let yieldDistributor: YieldDistributor;
  let stablecoin: MockERC20;
  
  let owner: SignerWithAddress;
  let propertyManager: SignerWithAddress;
  let paymentProcessor: SignerWithAddress;
  let unauthorizedUser: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  
  const PROPERTY_ADDRESS = "123 Main St, San Francisco, CA";
  const PROPERTY_TYPE = "Single Family";
  const PROPERTY_VALUATION = ethers.parseEther("500000");
  const INITIAL_PRICE = ethers.parseUnits("2000", 6); // $2000 USDC
  
  beforeEach(async function () {
    [owner, propertyManager, paymentProcessor, unauthorizedUser, user1, user2] = await ethers.getSigners();
    
    // Deploy PropertyToken
    const PropertyTokenFactory = await ethers.getContractFactory("PropertyToken");
    propertyToken = await PropertyTokenFactory.deploy(
      PROPERTY_ADDRESS,
      PROPERTY_TYPE,
      PROPERTY_VALUATION,
      propertyManager.address,
      "",
      ""
    );
    
    // Deploy PriceManager
    const PriceManagerFactory = await ethers.getContractFactory("PriceManager");
    priceManager = await PriceManagerFactory.deploy(
      INITIAL_PRICE,
      propertyManager.address
    );
    
    // Deploy Mock Stablecoin
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    stablecoin = await MockERC20Factory.deploy("USD Coin", "USDC", 6);
    
    // Deploy YieldDistributor
    const YieldDistributorFactory = await ethers.getContractFactory("YieldDistributor");
    yieldDistributor = await YieldDistributorFactory.deploy(
      await propertyToken.getAddress(),
      await stablecoin.getAddress(),
      propertyManager.address,
      paymentProcessor.address,
      await priceManager.getAddress()
    );
  });
  
  describe("PropertyToken Access Control", function () {
    describe("Whitelist Management", function () {
      it("Should allow property manager to add addresses to whitelist", async function () {
        await propertyToken.connect(propertyManager).addToWhitelist(user1.address);
        expect(await propertyToken.isWhitelisted(user1.address)).to.be.true;
      });
      
      it("Should allow property manager to remove addresses from whitelist", async function () {
        await propertyToken.connect(propertyManager).addToWhitelist(user1.address);
        await propertyToken.connect(propertyManager).removeFromWhitelist(user1.address);
        expect(await propertyToken.isWhitelisted(user1.address)).to.be.false;
      });
      
      it("Should revert when unauthorized user tries to add to whitelist", async function () {
        await expect(
          propertyToken.connect(unauthorizedUser).addToWhitelist(user1.address)
        ).to.be.reverted;
      });
      
      it("Should revert when unauthorized user tries to remove from whitelist", async function () {
        await propertyToken.connect(propertyManager).addToWhitelist(user1.address);
        await expect(
          propertyToken.connect(unauthorizedUser).removeFromWhitelist(user1.address)
        ).to.be.reverted;
      });
      
      it("Should allow batch whitelisting by property manager", async function () {
        await propertyToken.connect(propertyManager).batchAddToWhitelist([user1.address, user2.address]);
        expect(await propertyToken.isWhitelisted(user1.address)).to.be.true;
        expect(await propertyToken.isWhitelisted(user2.address)).to.be.true;
      });
    });
    
    describe("Token Issuance", function () {
      it("Should allow issuer to mint new tokens", async function () {
        const amount = ethers.parseEther("10");
        await propertyToken.connect(propertyManager).addToWhitelist(user1.address);
        await propertyToken.issue(user1.address, amount, "0x");
        expect(await propertyToken.balanceOf(user1.address)).to.equal(amount);
      });
      
      it("Should revert when unauthorized user tries to issue tokens", async function () {
        const amount = ethers.parseEther("10");
        await expect(
          propertyToken.connect(unauthorizedUser).issue(user1.address, amount, "0x")
        ).to.be.reverted;
      });
    });
    
    describe("Controller Operations", function () {
      it("Should allow controller to force transfer", async function () {
        const amount = ethers.parseEther("10");
        await propertyToken.connect(propertyManager).addToWhitelist(user1.address);
        await propertyToken.transfer(user1.address, amount);
        
        // Owner has CONTROLLER_ROLE by default, so they can force transfer
        const CONTROLLER_ROLE = await propertyToken.CONTROLLER_ROLE();
        await propertyToken.grantRole(CONTROLLER_ROLE, owner.address);
        
        await propertyToken.controllerTransfer(user1.address, owner.address, amount, "0x", "0x");
        expect(await propertyToken.balanceOf(owner.address)).to.be.gte(amount);
      });
      
      it("Should revert when unauthorized user tries controller transfer", async function () {
        const amount = ethers.parseEther("10");
        await expect(
          propertyToken.connect(unauthorizedUser).controllerTransfer(owner.address, user1.address, amount, "0x", "0x")
        ).to.be.reverted;
      });
    });
    
    describe("Role Management", function () {
      it("Should allow owner to grant roles", async function () {
        const PROPERTY_MANAGER_ROLE = await propertyToken.PROPERTY_MANAGER_ROLE();
        await propertyToken.grantRole(PROPERTY_MANAGER_ROLE, user1.address);
        expect(await propertyToken.hasRole(PROPERTY_MANAGER_ROLE, user1.address)).to.be.true;
      });
      
      it("Should allow owner to revoke roles", async function () {
        const PROPERTY_MANAGER_ROLE = await propertyToken.PROPERTY_MANAGER_ROLE();
        await propertyToken.grantRole(PROPERTY_MANAGER_ROLE, user1.address);
        await propertyToken.revokeRole(PROPERTY_MANAGER_ROLE, user1.address);
        expect(await propertyToken.hasRole(PROPERTY_MANAGER_ROLE, user1.address)).to.be.false;
      });
      
      it("Should revert when unauthorized user tries to grant roles", async function () {
        const PROPERTY_MANAGER_ROLE = await propertyToken.PROPERTY_MANAGER_ROLE();
        await expect(
          propertyToken.connect(unauthorizedUser).grantRole(PROPERTY_MANAGER_ROLE, user1.address)
        ).to.be.reverted;
      });

      it("Should use 2-step admin transfer (AccessControlDefaultAdminRules)", async function () {
        await propertyToken.beginDefaultAdminTransfer(user1.address);
        const [newAdmin, schedule] = await propertyToken.pendingDefaultAdmin();
        expect(newAdmin).to.equal(user1.address);
        expect(schedule).to.be.gt(0n);
        await propertyToken.cancelDefaultAdminTransfer();
      });

      it("Should complete admin transfer after delay via time travel", async function () {
        const DEFAULT_ADMIN_ROLE = await propertyToken.DEFAULT_ADMIN_ROLE();
        const delay = await propertyToken.defaultAdminDelay();
        await propertyToken.beginDefaultAdminTransfer(user1.address);
        await ethers.provider.send("evm_increaseTime", [Number(delay) + 1]);
        await ethers.provider.send("evm_mine", []);
        await propertyToken.connect(user1).acceptDefaultAdminTransfer();
        expect(await propertyToken.defaultAdmin()).to.equal(user1.address);
        expect(await propertyToken.hasRole(DEFAULT_ADMIN_ROLE, user1.address)).to.be.true;
      });
    });
  });
  
  describe("PriceManager Access Control", function () {
    describe("Recommendation Submission", function () {
      it("Should allow property manager to submit recommendations", async function () {
        await priceManager.connect(propertyManager).submitRecommendation(
          ethers.parseUnits("2500", 6),
          85,
          "Market analysis suggests price increase"
        );
        expect(await priceManager.recommendationCount()).to.equal(1);
      });
      
      it("Should revert when unauthorized user tries to submit recommendation", async function () {
        await expect(
          priceManager.connect(unauthorizedUser).submitRecommendation(
            ethers.parseUnits("2500", 6),
            85,
            "Unauthorized recommendation"
          )
        ).to.be.reverted;
      });
    });
    
    describe("Recommendation Acceptance", function () {
      beforeEach(async function () {
        await priceManager.connect(propertyManager).submitRecommendation(
          ethers.parseUnits("2500", 6),
          85,
          "Market analysis"
        );
      });
      
      it("Should allow property manager to accept recommendations", async function () {
        await priceManager.connect(propertyManager).acceptRecommendation(1);
        expect(await priceManager.getCurrentRentalPrice()).to.equal(ethers.parseUnits("2500", 6));
      });
      
      it("Should revert when unauthorized user tries to accept recommendation", async function () {
        await expect(
          priceManager.connect(unauthorizedUser).acceptRecommendation(1)
        ).to.be.reverted;
      });
    });
    
    describe("Recommendation Rejection", function () {
      beforeEach(async function () {
        await priceManager.connect(propertyManager).submitRecommendation(
          ethers.parseUnits("2500", 6),
          85,
          "Market analysis"
        );
      });
      
      it("Should allow property manager to reject recommendations", async function () {
        await priceManager.connect(propertyManager).rejectRecommendation(1);
        const recommendation = await priceManager.getRecommendation(1);
        expect(recommendation.rejected).to.be.true;
      });
      
      it("Should revert when unauthorized user tries to reject recommendation", async function () {
        await expect(
          priceManager.connect(unauthorizedUser).rejectRecommendation(1)
        ).to.be.reverted;
      });
    });
    
    describe("Role Management", function () {
      it("Should allow owner to grant property manager role", async function () {
        const PROPERTY_MANAGER_ROLE = await priceManager.PROPERTY_MANAGER_ROLE();
        await priceManager.grantRole(PROPERTY_MANAGER_ROLE, user1.address);
        expect(await priceManager.hasRole(PROPERTY_MANAGER_ROLE, user1.address)).to.be.true;
      });
      
      it("Should allow owner to revoke roles", async function () {
        const PROPERTY_MANAGER_ROLE = await priceManager.PROPERTY_MANAGER_ROLE();
        await priceManager.grantRole(PROPERTY_MANAGER_ROLE, user1.address);
        await priceManager.revokeRole(PROPERTY_MANAGER_ROLE, user1.address);
        expect(await priceManager.hasRole(PROPERTY_MANAGER_ROLE, user1.address)).to.be.false;
      });
    });
  });
  
  describe("YieldDistributor Access Control", function () {
    describe("Rental Payment Reception", function () {
      beforeEach(async function () {
        await stablecoin.mint(paymentProcessor.address, ethers.parseUnits("10000", 6));
        await stablecoin.connect(paymentProcessor).approve(
          await yieldDistributor.getAddress(),
          ethers.parseUnits("10000", 6)
        );
      });
      
      it("Should allow payment processor to receive rental payments", async function () {
        await yieldDistributor.connect(paymentProcessor).receiveRentalPayment(ethers.parseUnits("2000", 6));
        expect(await yieldDistributor.getDistributionPool()).to.equal(ethers.parseUnits("2000", 6));
      });
      
      it("Should revert when unauthorized user tries to receive payment", async function () {
        await expect(
          yieldDistributor.connect(unauthorizedUser).receiveRentalPayment(ethers.parseUnits("2000", 6))
        ).to.be.reverted;
      });
      
      it("Should revert when property manager tries to receive payment", async function () {
        await expect(
          yieldDistributor.connect(propertyManager).receiveRentalPayment(ethers.parseUnits("2000", 6))
        ).to.be.reverted;
      });
    });
    
    describe("Yield Distribution", function () {
      beforeEach(async function () {
        // Setup holders
        await propertyToken.connect(propertyManager).addToWhitelist(user1.address);
        await propertyToken.connect(propertyManager).addToWhitelist(user2.address);
        await propertyToken.transfer(user1.address, ethers.parseEther("50"));
        await propertyToken.transfer(user2.address, ethers.parseEther("30"));
        
        await yieldDistributor.connect(propertyManager).registerHolders([user1.address, user2.address]);
        
        // Add payment
        await stablecoin.mint(paymentProcessor.address, ethers.parseUnits("2000", 6));
        await stablecoin.connect(paymentProcessor).approve(
          await yieldDistributor.getAddress(),
          ethers.parseUnits("2000", 6)
        );
        await yieldDistributor.connect(paymentProcessor).receiveRentalPayment(ethers.parseUnits("2000", 6));
      });
      
      it("Should allow property manager to distribute yields", async function () {
        await yieldDistributor.connect(propertyManager).distributeYields();
        expect(await yieldDistributor.getDistributionPool()).to.equal(0);
      });
      
      it("Should revert when unauthorized user tries to distribute yields", async function () {
        await expect(
          yieldDistributor.connect(unauthorizedUser).distributeYields()
        ).to.be.reverted;
      });
      
      it("Should revert when payment processor tries to distribute yields", async function () {
        await expect(
          yieldDistributor.connect(paymentProcessor).distributeYields()
        ).to.be.reverted;
      });
    });
    
    describe("Holder Registration", function () {
      it("Should allow property manager to register holders", async function () {
        await yieldDistributor.connect(propertyManager).registerHolder(user1.address);
        expect(await yieldDistributor.isRegisteredHolder(user1.address)).to.be.true;
      });
      
      it("Should allow property manager to register multiple holders", async function () {
        await yieldDistributor.connect(propertyManager).registerHolders([user1.address, user2.address]);
        expect(await yieldDistributor.isRegisteredHolder(user1.address)).to.be.true;
        expect(await yieldDistributor.isRegisteredHolder(user2.address)).to.be.true;
      });
      
      it("Should revert when unauthorized user tries to register holders", async function () {
        await expect(
          yieldDistributor.connect(unauthorizedUser).registerHolder(user1.address)
        ).to.be.reverted;
      });
    });
    
    describe("Role Management", function () {
      it("Should allow owner to grant payment processor role", async function () {
        const PAYMENT_PROCESSOR_ROLE = await yieldDistributor.PAYMENT_PROCESSOR_ROLE();
        await yieldDistributor.grantRole(PAYMENT_PROCESSOR_ROLE, user1.address);
        expect(await yieldDistributor.hasRole(PAYMENT_PROCESSOR_ROLE, user1.address)).to.be.true;
      });
      
      it("Should allow owner to revoke roles", async function () {
        const PAYMENT_PROCESSOR_ROLE = await yieldDistributor.PAYMENT_PROCESSOR_ROLE();
        await yieldDistributor.grantRole(PAYMENT_PROCESSOR_ROLE, user1.address);
        await yieldDistributor.revokeRole(PAYMENT_PROCESSOR_ROLE, user1.address);
        expect(await yieldDistributor.hasRole(PAYMENT_PROCESSOR_ROLE, user1.address)).to.be.false;
      });
    });
  });
  
  describe("Cross-Contract Access Control", function () {
    beforeEach(async function () {
      await priceManager.connect(propertyManager).submitRecommendation(
        ethers.parseUnits("2500", 6),
        85,
        "Market analysis"
      );
    });

    it("Should maintain separate role hierarchies across contracts", async function () {
      const PT_MANAGER_ROLE = await propertyToken.PROPERTY_MANAGER_ROLE();
      const PM_MANAGER_ROLE = await priceManager.PROPERTY_MANAGER_ROLE();
      const YD_MANAGER_ROLE = await yieldDistributor.PROPERTY_MANAGER_ROLE();
      
      // Property manager should have role in all contracts
      expect(await propertyToken.hasRole(PT_MANAGER_ROLE, propertyManager.address)).to.be.true;
      expect(await priceManager.hasRole(PM_MANAGER_ROLE, propertyManager.address)).to.be.true;
      expect(await yieldDistributor.hasRole(YD_MANAGER_ROLE, propertyManager.address)).to.be.true;
      
      // Payment processor should only have role in YieldDistributor
      const PAYMENT_PROCESSOR_ROLE = await yieldDistributor.PAYMENT_PROCESSOR_ROLE();
      expect(await yieldDistributor.hasRole(PAYMENT_PROCESSOR_ROLE, paymentProcessor.address)).to.be.true;
    });
    
    it("Should prevent role escalation across contracts", async function () {
      // Unauthorized user cannot perform property manager operations
      await expect(
        priceManager.connect(unauthorizedUser).acceptRecommendation(1)
      ).to.be.reverted;
      
      // Payment processor cannot perform property manager operations
      await expect(
        yieldDistributor.connect(paymentProcessor).distributeYields()
      ).to.be.reverted;
    });
  });
});
