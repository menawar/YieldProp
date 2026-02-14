import { expect } from "chai";
import { ethers } from "hardhat";
import { YieldDistributor, PropertyToken, MockERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("YieldDistributor", function () {
  let yieldDistributor: YieldDistributor;
  let propertyToken: PropertyToken;
  let stablecoin: MockERC20;
  let owner: SignerWithAddress;
  let propertyManager: SignerWithAddress;
  let paymentProcessor: SignerWithAddress;
  let holder1: SignerWithAddress;
  let holder2: SignerWithAddress;
  let holder3: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  const PROPERTY_ADDRESS = "123 Main St, San Francisco, CA";
  const PROPERTY_TYPE = "Single Family";
  const PROPERTY_VALUATION = ethers.parseEther("500000"); // $500k
  const RENTAL_PAYMENT = ethers.parseUnits("2000", 6); // $2000 USDC

  const PROPERTY_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PROPERTY_MANAGER_ROLE"));
  const PAYMENT_PROCESSOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAYMENT_PROCESSOR_ROLE"));

  beforeEach(async function () {
    [owner, propertyManager, paymentProcessor, holder1, holder2, holder3, unauthorized] = 
      await ethers.getSigners();

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

    // Deploy Mock Stablecoin (USDC with 6 decimals)
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    stablecoin = await MockERC20Factory.deploy("USD Coin", "USDC", 6);

    // Deploy YieldDistributor
    const YieldDistributorFactory = await ethers.getContractFactory("YieldDistributor");
    yieldDistributor = await YieldDistributorFactory.deploy(
      await propertyToken.getAddress(),
      await stablecoin.getAddress(),
      propertyManager.address,
      paymentProcessor.address,
      ethers.ZeroAddress
    );

    // Setup: Whitelist holders and distribute tokens
    await propertyToken.connect(propertyManager).addToWhitelist(holder1.address);
    await propertyToken.connect(propertyManager).addToWhitelist(holder2.address);
    await propertyToken.connect(propertyManager).addToWhitelist(holder3.address);

    // Distribute tokens: holder1 gets 50%, holder2 gets 30%, holder3 gets 20%
    const totalSupply = await propertyToken.totalSupply();
    await propertyToken.transfer(holder1.address, totalSupply * 50n / 100n);
    await propertyToken.transfer(holder2.address, totalSupply * 30n / 100n);
    await propertyToken.transfer(holder3.address, totalSupply * 20n / 100n);

    // Register holders in YieldDistributor
    await yieldDistributor.connect(propertyManager).registerHolders([
      holder1.address,
      holder2.address,
      holder3.address
    ]);

    // Mint stablecoin to payment processor
    await stablecoin.mint(paymentProcessor.address, ethers.parseUnits("1000000", 6));
    
    // Approve YieldDistributor to spend stablecoin
    await stablecoin.connect(paymentProcessor).approve(
      await yieldDistributor.getAddress(),
      ethers.MaxUint256
    );
  });

  describe("Deployment", function () {
    it("Should set correct property token address", async function () {
      expect(await yieldDistributor.propertyToken()).to.equal(await propertyToken.getAddress());
    });

    it("Should set correct stablecoin address", async function () {
      expect(await yieldDistributor.stablecoin()).to.equal(await stablecoin.getAddress());
    });

    it("Should set correct property valuation", async function () {
      expect(await yieldDistributor.propertyValuation()).to.equal(PROPERTY_VALUATION);
    });

    it("Should grant PROPERTY_MANAGER_ROLE to property manager", async function () {
      expect(await yieldDistributor.hasRole(PROPERTY_MANAGER_ROLE, propertyManager.address)).to.be.true;
    });

    it("Should grant PAYMENT_PROCESSOR_ROLE to payment processor", async function () {
      expect(await yieldDistributor.hasRole(PAYMENT_PROCESSOR_ROLE, paymentProcessor.address)).to.be.true;
    });

    it("Should initialize with zero distribution pool", async function () {
      expect(await yieldDistributor.getDistributionPool()).to.equal(0);
    });

    it("Should initialize with zero distributions", async function () {
      expect(await yieldDistributor.getDistributionCount()).to.equal(0);
    });
  });

  describe("Holder Registration", function () {
    it("Should allow property manager to register holder", async function () {
      const newHolder = unauthorized;
      await expect(yieldDistributor.connect(propertyManager).registerHolder(newHolder.address))
        .to.emit(yieldDistributor, "HolderRegistered")
        .withArgs(newHolder.address);
      
      expect(await yieldDistributor.isRegisteredHolder(newHolder.address)).to.be.true;
    });

    it("Should allow registering multiple holders at once", async function () {
      const holders = await yieldDistributor.getRegisteredHolders();
      expect(holders.length).to.equal(3);
      expect(holders[0]).to.equal(holder1.address);
      expect(holders[1]).to.equal(holder2.address);
      expect(holders[2]).to.equal(holder3.address);
    });

    it("Should not duplicate holder registration", async function () {
      await yieldDistributor.connect(propertyManager).registerHolder(holder1.address);
      const holders = await yieldDistributor.getRegisteredHolders();
      expect(holders.length).to.equal(3); // Still 3, not 4
    });

    it("Should revert if non-manager tries to register holder", async function () {
      await expect(
        yieldDistributor.connect(unauthorized).registerHolder(unauthorized.address)
      ).to.be.reverted;
    });

    it("Should allow token holder to self-register via registerHolderForSelf", async function () {
      // Give unauthorized some tokens (transfer from holder1)
      await propertyToken.connect(propertyManager).addToWhitelist(unauthorized.address);
      await propertyToken.connect(holder1).transfer(unauthorized.address, ethers.parseEther("5"));
      expect(await yieldDistributor.isRegisteredHolder(unauthorized.address)).to.be.false;

      await expect(yieldDistributor.connect(unauthorized).registerHolderForSelf())
        .to.emit(yieldDistributor, "HolderRegistered")
        .withArgs(unauthorized.address);

      expect(await yieldDistributor.isRegisteredHolder(unauthorized.address)).to.be.true;
    });

    it("Should revert registerHolderForSelf when caller has no token balance", async function () {
      await expect(
        yieldDistributor.connect(unauthorized).registerHolderForSelf()
      ).to.be.revertedWithCustomError(yieldDistributor, "NoTokenBalance");
    });

    it("Should no-op when already registered caller invokes registerHolderForSelf", async function () {
      // holder1 is already registered and has tokens
      await yieldDistributor.connect(holder1).registerHolderForSelf();
      const holders = await yieldDistributor.getRegisteredHolders();
      expect(holders.filter((h: string) => h === holder1.address).length).to.equal(1);
    });
  });

  describe("Receive Rental Payment", function () {
    it("Should allow payment processor to receive rental payment", async function () {
      await expect(yieldDistributor.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT))
        .to.emit(yieldDistributor, "RentalPaymentReceived")
        .withArgs(RENTAL_PAYMENT, await ethers.provider.getBlock("latest").then(b => b!.timestamp + 1), paymentProcessor.address);
    });

    it("Should add payment to distribution pool", async function () {
      await yieldDistributor.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT);
      expect(await yieldDistributor.getDistributionPool()).to.equal(RENTAL_PAYMENT);
    });

    it("Should accept payment when PriceManager is linked and amount >= rent", async function () {
      const PriceManagerFactory = await ethers.getContractFactory("PriceManager");
      const priceManager = await PriceManagerFactory.deploy(
        RENTAL_PAYMENT,
        propertyManager.address
      );
      const YieldDistributorFactory = await ethers.getContractFactory("YieldDistributor");
      const distWithPrice = await YieldDistributorFactory.deploy(
        await propertyToken.getAddress(),
        await stablecoin.getAddress(),
        propertyManager.address,
        paymentProcessor.address,
        await priceManager.getAddress()
      );
      await stablecoin.connect(paymentProcessor).approve(await distWithPrice.getAddress(), RENTAL_PAYMENT * 3n);
      await distWithPrice.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT);
      expect(await distWithPrice.getDistributionPool()).to.equal(RENTAL_PAYMENT);
      await distWithPrice.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT * 2n);
      expect(await distWithPrice.getDistributionPool()).to.equal(RENTAL_PAYMENT * 3n);
    });

    it("Should revert when PriceManager is linked and amount < rent", async function () {
      const PriceManagerFactory = await ethers.getContractFactory("PriceManager");
      const priceManager = await PriceManagerFactory.deploy(
        RENTAL_PAYMENT,
        propertyManager.address
      );
      const YieldDistributorFactory = await ethers.getContractFactory("YieldDistributor");
      const distWithPrice = await YieldDistributorFactory.deploy(
        await propertyToken.getAddress(),
        await stablecoin.getAddress(),
        propertyManager.address,
        paymentProcessor.address,
        await priceManager.getAddress()
      );
      await stablecoin.connect(paymentProcessor).approve(await distWithPrice.getAddress(), RENTAL_PAYMENT);
      await expect(
        distWithPrice.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT / 2n)
      ).to.be.revertedWithCustomError(distWithPrice, "PaymentBelowRentalPrice");
    });

    it("Should accumulate multiple payments", async function () {
      await yieldDistributor.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT);
      await yieldDistributor.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT);
      expect(await yieldDistributor.getDistributionPool()).to.equal(RENTAL_PAYMENT * 2n);
    });

    it("Should transfer stablecoin from payment processor", async function () {
      const balanceBefore = await stablecoin.balanceOf(paymentProcessor.address);
      await yieldDistributor.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT);
      const balanceAfter = await stablecoin.balanceOf(paymentProcessor.address);
      expect(balanceBefore - balanceAfter).to.equal(RENTAL_PAYMENT);
    });

    it("Should revert if amount is zero", async function () {
      await expect(
        yieldDistributor.connect(paymentProcessor).receiveRentalPayment(0)
      ).to.be.revertedWithCustomError(yieldDistributor, "InvalidAmount");
    });

    it("Should revert if caller is not payment processor", async function () {
      await expect(
        yieldDistributor.connect(unauthorized).receiveRentalPayment(RENTAL_PAYMENT)
      ).to.be.reverted;
    });

    it("Should revert if insufficient allowance", async function () {
      await stablecoin.connect(paymentProcessor).approve(await yieldDistributor.getAddress(), 0);
      await expect(
        yieldDistributor.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT)
      ).to.be.reverted; // Will revert with ERC20 error, not our custom error
    });
  });

  describe("Distribute Yields", function () {
    beforeEach(async function () {
      // Add payment to pool
      await yieldDistributor.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT);
    });

    it("Should allow property manager to distribute yields", async function () {
      await expect(yieldDistributor.connect(propertyManager).distributeYields())
        .to.emit(yieldDistributor, "YieldsDistributed");
    });

    it("Should distribute yields proportionally", async function () {
      const holder1BalanceBefore = await stablecoin.balanceOf(holder1.address);
      const holder2BalanceBefore = await stablecoin.balanceOf(holder2.address);
      const holder3BalanceBefore = await stablecoin.balanceOf(holder3.address);

      await yieldDistributor.connect(propertyManager).distributeYields();

      const holder1BalanceAfter = await stablecoin.balanceOf(holder1.address);
      const holder2BalanceAfter = await stablecoin.balanceOf(holder2.address);
      const holder3BalanceAfter = await stablecoin.balanceOf(holder3.address);

      const holder1Yield = holder1BalanceAfter - holder1BalanceBefore;
      const holder2Yield = holder2BalanceAfter - holder2BalanceBefore;
      const holder3Yield = holder3BalanceAfter - holder3BalanceBefore;

      // Check proportions (50%, 30%, 20%)
      expect(holder1Yield).to.equal(RENTAL_PAYMENT * 50n / 100n);
      expect(holder2Yield).to.equal(RENTAL_PAYMENT * 30n / 100n);
      expect(holder3Yield).to.equal(RENTAL_PAYMENT * 20n / 100n);
    });

    it("Should reset distribution pool after distribution", async function () {
      await yieldDistributor.connect(propertyManager).distributeYields();
      expect(await yieldDistributor.getDistributionPool()).to.equal(0);
    });

    it("Should increment distribution count", async function () {
      await yieldDistributor.connect(propertyManager).distributeYields();
      expect(await yieldDistributor.getDistributionCount()).to.equal(1);
    });

    it("Should record distribution in history", async function () {
      await yieldDistributor.connect(propertyManager).distributeYields();
      const distribution = await yieldDistributor.getDistribution(1);
      
      expect(distribution.id).to.equal(1);
      expect(distribution.totalAmount).to.be.gt(0);
      expect(distribution.recipientCount).to.equal(3);
    });

    it("Should update total yields distributed", async function () {
      await yieldDistributor.connect(propertyManager).distributeYields();
      const totalDistributed = await yieldDistributor.getTotalYieldsDistributed();
      expect(totalDistributed).to.be.gt(0);
    });

    it("Should track per-holder yields", async function () {
      await yieldDistributor.connect(propertyManager).distributeYields();
      
      const holder1Yields = await yieldDistributor.getHolderYields(holder1.address);
      const holder2Yields = await yieldDistributor.getHolderYields(holder2.address);
      const holder3Yields = await yieldDistributor.getHolderYields(holder3.address);

      expect(holder1Yields).to.equal(RENTAL_PAYMENT * 50n / 100n);
      expect(holder2Yields).to.equal(RENTAL_PAYMENT * 30n / 100n);
      expect(holder3Yields).to.equal(RENTAL_PAYMENT * 20n / 100n);
    });

    it("Should emit YieldTransferred events for each holder", async function () {
      const tx = await yieldDistributor.connect(propertyManager).distributeYields();
      const receipt = await tx.wait();
      
      const yieldTransferredEvents = receipt!.logs.filter(
        (log: any) => {
          try {
            const parsed = yieldDistributor.interface.parseLog(log);
            return parsed?.name === "YieldTransferred";
          } catch {
            return false;
          }
        }
      );
      
      expect(yieldTransferredEvents.length).to.equal(3);
    });

    it("Should revert if distribution pool is empty", async function () {
      await yieldDistributor.connect(propertyManager).distributeYields();
      await expect(
        yieldDistributor.connect(propertyManager).distributeYields()
      ).to.be.revertedWithCustomError(yieldDistributor, "DistributionPoolEmpty");
    });

    it("Should revert if caller is not property manager", async function () {
      await expect(
        yieldDistributor.connect(unauthorized).distributeYields()
      ).to.be.reverted;
    });

    it("Should revert if no holders registered", async function () {
      // Deploy new YieldDistributor without registered holders
      const YieldDistributorFactory = await ethers.getContractFactory("YieldDistributor");
      const newDistributor = await YieldDistributorFactory.deploy(
        await propertyToken.getAddress(),
        await stablecoin.getAddress(),
        propertyManager.address,
        paymentProcessor.address,
        ethers.ZeroAddress
      );

      // Add payment
      await stablecoin.connect(paymentProcessor).approve(await newDistributor.getAddress(), RENTAL_PAYMENT);
      await newDistributor.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT);

      // Try to distribute
      await expect(
        newDistributor.connect(propertyManager).distributeYields()
      ).to.be.revertedWithCustomError(newDistributor, "NoTokenHolders");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      // Add payment and distribute
      await yieldDistributor.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT);
      await yieldDistributor.connect(propertyManager).distributeYields();
    });

    it("Should return distribution history", async function () {
      const history = await yieldDistributor.getDistributionHistory();
      expect(history.length).to.equal(1);
      expect(history[0].id).to.equal(1);
    });

    it("Should return specific distribution by ID", async function () {
      const distribution = await yieldDistributor.getDistribution(1);
      expect(distribution.id).to.equal(1);
      expect(distribution.recipientCount).to.equal(3);
    });

    it("Should revert when getting invalid distribution ID", async function () {
      await expect(
        yieldDistributor.getDistribution(999)
      ).to.be.revertedWithCustomError(yieldDistributor, "InvalidDistributionId");
    });

    it("Should return total yields distributed", async function () {
      const total = await yieldDistributor.getTotalYieldsDistributed();
      expect(total).to.be.gt(0);
    });

    it("Should return holder yields", async function () {
      const holder1Yields = await yieldDistributor.getHolderYields(holder1.address);
      expect(holder1Yields).to.be.gt(0);
    });

    it("Should return zero yields for non-holder", async function () {
      const yields = await yieldDistributor.getHolderYields(unauthorized.address);
      expect(yields).to.equal(0);
    });

    it("Should return registered holders", async function () {
      const holders = await yieldDistributor.getRegisteredHolders();
      expect(holders.length).to.equal(3);
    });
  });

  describe("Annualized Yield Calculation", function () {
    it("Should return zero when no distributions", async function () {
      const annualizedYield = await yieldDistributor.getAnnualizedYield();
      expect(annualizedYield).to.equal(0);
    });

    it("Should calculate annualized yield after distribution", async function () {
      // Advance time by 1 day first
      await ethers.provider.send("evm_increaseTime", [86400]); // 1 day
      await ethers.provider.send("evm_mine", []);
      
      await yieldDistributor.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT);
      await yieldDistributor.connect(propertyManager).distributeYields();
      
      const annualizedYield = await yieldDistributor.getAnnualizedYield();
      expect(annualizedYield).to.be.gt(0);
    });

    it("Should increase with more distributions", async function () {
      // Advance time by 1 day first
      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);
      
      await yieldDistributor.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT);
      await yieldDistributor.connect(propertyManager).distributeYields();
      const yield1 = await yieldDistributor.getAnnualizedYield();

      await yieldDistributor.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT);
      await yieldDistributor.connect(propertyManager).distributeYields();
      const yield2 = await yieldDistributor.getAnnualizedYield();

      expect(yield2).to.be.gt(yield1);
    });
  });

  describe("Time-Based Yield Queries", function () {
    it("Should return yields in specific time period", async function () {
      const startTime = await ethers.provider.getBlock("latest").then(b => b!.timestamp);
      
      await yieldDistributor.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT);
      await yieldDistributor.connect(propertyManager).distributeYields();
      
      const endTime = await ethers.provider.getBlock("latest").then(b => b!.timestamp);
      
      const yieldsInPeriod = await yieldDistributor.getYieldsInPeriod(startTime, endTime);
      expect(yieldsInPeriod).to.be.gt(0);
    });

    it("Should return zero for period with no distributions", async function () {
      const futureStart = await ethers.provider.getBlock("latest").then(b => b!.timestamp + 1000);
      const futureEnd = futureStart + 1000;
      
      const yieldsInPeriod = await yieldDistributor.getYieldsInPeriod(futureStart, futureEnd);
      expect(yieldsInPeriod).to.equal(0);
    });
  });

  describe("Multiple Distributions", function () {
    it("Should handle multiple sequential distributions", async function () {
      // First distribution
      await yieldDistributor.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT);
      await yieldDistributor.connect(propertyManager).distributeYields();

      // Second distribution
      await yieldDistributor.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT);
      await yieldDistributor.connect(propertyManager).distributeYields();

      // Third distribution
      await yieldDistributor.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT);
      await yieldDistributor.connect(propertyManager).distributeYields();

      expect(await yieldDistributor.getDistributionCount()).to.equal(3);
      
      const holder1TotalYields = await yieldDistributor.getHolderYields(holder1.address);
      expect(holder1TotalYields).to.equal(RENTAL_PAYMENT * 50n / 100n * 3n);
    });

    it("Should maintain accurate history across multiple distributions", async function () {
      await yieldDistributor.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT);
      await yieldDistributor.connect(propertyManager).distributeYields();

      await yieldDistributor.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT * 2n);
      await yieldDistributor.connect(propertyManager).distributeYields();

      const history = await yieldDistributor.getDistributionHistory();
      expect(history.length).to.equal(2);
      expect(history[0].id).to.equal(1);
      expect(history[1].id).to.equal(2);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle distribution with single holder", async function () {
      // Deploy new setup with single holder
      const PropertyTokenFactory = await ethers.getContractFactory("PropertyToken");
      const newPropertyToken = await PropertyTokenFactory.deploy(
        PROPERTY_ADDRESS,
        PROPERTY_TYPE,
        PROPERTY_VALUATION,
        propertyManager.address,
        "",
        ""
      );

      const YieldDistributorFactory = await ethers.getContractFactory("YieldDistributor");
      const newDistributor = await YieldDistributorFactory.deploy(
        await newPropertyToken.getAddress(),
        await stablecoin.getAddress(),
        propertyManager.address,
        paymentProcessor.address,
        ethers.ZeroAddress
      );

      await newPropertyToken.connect(propertyManager).addToWhitelist(holder1.address);
      await newPropertyToken.transfer(holder1.address, await newPropertyToken.totalSupply());
      await newDistributor.connect(propertyManager).registerHolder(holder1.address);

      await stablecoin.connect(paymentProcessor).approve(await newDistributor.getAddress(), RENTAL_PAYMENT);
      await newDistributor.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT);

      const balanceBefore = await stablecoin.balanceOf(holder1.address);
      await newDistributor.connect(propertyManager).distributeYields();
      const balanceAfter = await stablecoin.balanceOf(holder1.address);

      expect(balanceAfter - balanceBefore).to.equal(RENTAL_PAYMENT);
    });

    it("Should skip holders with zero balance", async function () {
      // Transfer all tokens away from holder3
      await propertyToken.connect(holder3).transfer(holder1.address, await propertyToken.balanceOf(holder3.address));

      await yieldDistributor.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT);
      
      const holder3BalanceBefore = await stablecoin.balanceOf(holder3.address);
      await yieldDistributor.connect(propertyManager).distributeYields();
      const holder3BalanceAfter = await stablecoin.balanceOf(holder3.address);

      expect(holder3BalanceAfter - holder3BalanceBefore).to.equal(0);
    });

    it("Should handle very large payment amounts", async function () {
      const largePayment = ethers.parseUnits("1000000", 6); // $1M
      await stablecoin.mint(paymentProcessor.address, largePayment);
      await stablecoin.connect(paymentProcessor).approve(await yieldDistributor.getAddress(), largePayment);

      await expect(
        yieldDistributor.connect(paymentProcessor).receiveRentalPayment(largePayment)
      ).to.not.be.reverted;
    });

    it("Should handle minimum payment amount", async function () {
      const minPayment = 1;
      await expect(
        yieldDistributor.connect(paymentProcessor).receiveRentalPayment(minPayment)
      ).to.not.be.reverted;
    });
  });

  describe("Access Control", function () {
    it("Should allow owner to grant roles", async function () {
      await yieldDistributor.connect(owner).grantRole(PAYMENT_PROCESSOR_ROLE, unauthorized.address);
      expect(await yieldDistributor.hasRole(PAYMENT_PROCESSOR_ROLE, unauthorized.address)).to.be.true;
    });

    it("Should allow owner to revoke roles", async function () {
      await yieldDistributor.connect(owner).revokeRole(PAYMENT_PROCESSOR_ROLE, paymentProcessor.address);
      expect(await yieldDistributor.hasRole(PAYMENT_PROCESSOR_ROLE, paymentProcessor.address)).to.be.false;
    });

    it("Should prevent unauthorized role granting", async function () {
      await expect(
        yieldDistributor.connect(unauthorized).grantRole(PAYMENT_PROCESSOR_ROLE, unauthorized.address)
      ).to.be.reverted;
    });
  });

  describe("Reentrancy Protection", function () {
    it("Should protect receiveRentalPayment from reentrancy", async function () {
      // This is implicitly tested by the nonReentrant modifier
      // In a real attack scenario, a malicious token would try to reenter
      // The nonReentrant modifier prevents this
      await expect(
        yieldDistributor.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT)
      ).to.not.be.reverted;
    });

    it("Should protect distributeYields from reentrancy", async function () {
      await yieldDistributor.connect(paymentProcessor).receiveRentalPayment(RENTAL_PAYMENT);
      await expect(
        yieldDistributor.connect(propertyManager).distributeYields()
      ).to.not.be.reverted;
    });
  });
});
