import { expect } from "chai";
import { ethers } from "hardhat";
import { PriceManager } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("PriceManager", function () {
  let priceManager: PriceManager;
  let owner: SignerWithAddress;
  let propertyManager: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  const INITIAL_PRICE = ethers.parseUnits("2000", 6); // $2000 USDC (6 decimals)
  const PROPERTY_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PROPERTY_MANAGER_ROLE"));

  beforeEach(async function () {
    [owner, propertyManager, unauthorized] = await ethers.getSigners();

    const PriceManagerFactory = await ethers.getContractFactory("PriceManager");
    priceManager = await PriceManagerFactory.deploy(
      INITIAL_PRICE,
      propertyManager.address
    );
  });

  describe("Deployment", function () {
    it("Should set the correct initial rental price", async function () {
      expect(await priceManager.getCurrentRentalPrice()).to.equal(INITIAL_PRICE);
    });

    it("Should grant PROPERTY_MANAGER_ROLE to property manager", async function () {
      expect(await priceManager.hasRole(PROPERTY_MANAGER_ROLE, propertyManager.address)).to.be.true;
    });

    it("Should emit RentalPriceUpdated event on deployment", async function () {
      const PriceManagerFactory = await ethers.getContractFactory("PriceManager");
      const newPriceManager = await PriceManagerFactory.deploy(
        INITIAL_PRICE,
        propertyManager.address
      );

      // Check the event was emitted by querying the deployment transaction
      const deployTx = newPriceManager.deploymentTransaction();
      await expect(deployTx)
        .to.emit(newPriceManager, "RentalPriceUpdated")
        .withArgs(0, INITIAL_PRICE);
    });

    it("Should revert if initial price is zero", async function () {
      const PriceManagerFactory = await ethers.getContractFactory("PriceManager");
      await expect(
        PriceManagerFactory.deploy(0, propertyManager.address)
      ).to.be.revertedWithCustomError(PriceManagerFactory, "InvalidPrice");
    });

    it("Should revert if property manager address is zero", async function () {
      const PriceManagerFactory = await ethers.getContractFactory("PriceManager");
      await expect(
        PriceManagerFactory.deploy(INITIAL_PRICE, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(PriceManagerFactory, "InvalidAddress");
    });
  });

  describe("Submit Recommendation", function () {
    const recommendedPrice = ethers.parseUnits("2100", 6);
    const confidence = 85;
    const reasoning = "Market analysis shows 5% increase in comparable properties. Current occupancy rates are high, suggesting room for price increase.";

    it("Should allow property manager to submit recommendation", async function () {
      await expect(
        priceManager.connect(propertyManager).submitRecommendation(recommendedPrice, confidence, reasoning)
      )
        .to.emit(priceManager, "RecommendationSubmitted")
        .withArgs(1, recommendedPrice, confidence, reasoning, propertyManager.address);
    });

    it("Should increment recommendation count", async function () {
      await priceManager.connect(propertyManager).submitRecommendation(recommendedPrice, confidence, reasoning);
      expect(await priceManager.recommendationCount()).to.equal(1);

      await priceManager.connect(propertyManager).submitRecommendation(recommendedPrice, confidence, reasoning);
      expect(await priceManager.recommendationCount()).to.equal(2);
    });

    it("Should store recommendation with correct data", async function () {
      await priceManager.connect(propertyManager).submitRecommendation(recommendedPrice, confidence, reasoning);

      const recommendation = await priceManager.getRecommendation(1);
      expect(recommendation.id).to.equal(1);
      expect(recommendation.recommendedPrice).to.equal(recommendedPrice);
      expect(recommendation.confidenceScore).to.equal(confidence);
      expect(recommendation.reasoning).to.equal(reasoning);
      expect(recommendation.accepted).to.be.false;
      expect(recommendation.rejected).to.be.false;
      expect(recommendation.submitter).to.equal(propertyManager.address);
    });

    it("Should revert if caller is not property manager", async function () {
      await expect(
        priceManager.connect(unauthorized).submitRecommendation(recommendedPrice, confidence, reasoning)
      ).to.be.reverted;
    });

    it("Should revert if price is zero", async function () {
      await expect(
        priceManager.connect(propertyManager).submitRecommendation(0, confidence, reasoning)
      ).to.be.revertedWithCustomError(priceManager, "InvalidPrice");
    });

    it("Should revert if confidence score is greater than 100", async function () {
      await expect(
        priceManager.connect(propertyManager).submitRecommendation(recommendedPrice, 101, reasoning)
      ).to.be.revertedWithCustomError(priceManager, "InvalidConfidenceScore");
    });

    it("Should revert if reasoning is empty", async function () {
      await expect(
        priceManager.connect(propertyManager).submitRecommendation(recommendedPrice, confidence, "")
      ).to.be.revertedWithCustomError(priceManager, "EmptyReasoning");
    });

    it("Should allow confidence score of 0", async function () {
      await expect(
        priceManager.connect(propertyManager).submitRecommendation(recommendedPrice, 0, reasoning)
      ).to.not.be.reverted;
    });

    it("Should allow confidence score of 100", async function () {
      await expect(
        priceManager.connect(propertyManager).submitRecommendation(recommendedPrice, 100, reasoning)
      ).to.not.be.reverted;
    });
  });

  describe("Accept Recommendation", function () {
    const recommendedPrice = ethers.parseUnits("2100", 6);
    const confidence = 85;
    const reasoning = "Market analysis shows positive trends.";

    beforeEach(async function () {
      await priceManager.connect(propertyManager).submitRecommendation(recommendedPrice, confidence, reasoning);
    });

    it("Should allow property manager to accept recommendation", async function () {
      await expect(priceManager.connect(propertyManager).acceptRecommendation(1))
        .to.emit(priceManager, "RecommendationAccepted")
        .withArgs(1, recommendedPrice, propertyManager.address);
    });

    it("Should update current rental price when accepted", async function () {
      await priceManager.connect(propertyManager).acceptRecommendation(1);
      expect(await priceManager.getCurrentRentalPrice()).to.equal(recommendedPrice);
    });

    it("Should emit RentalPriceUpdated event", async function () {
      await expect(priceManager.connect(propertyManager).acceptRecommendation(1))
        .to.emit(priceManager, "RentalPriceUpdated")
        .withArgs(INITIAL_PRICE, recommendedPrice);
    });

    it("Should mark recommendation as accepted", async function () {
      await priceManager.connect(propertyManager).acceptRecommendation(1);
      const recommendation = await priceManager.getRecommendation(1);
      expect(recommendation.accepted).to.be.true;
      expect(recommendation.rejected).to.be.false;
    });

    it("Should revert if caller is not property manager", async function () {
      await expect(
        priceManager.connect(unauthorized).acceptRecommendation(1)
      ).to.be.reverted;
    });

    it("Should revert if recommendation ID is invalid", async function () {
      await expect(
        priceManager.connect(propertyManager).acceptRecommendation(999)
      ).to.be.revertedWithCustomError(priceManager, "InvalidRecommendationId");
    });

    it("Should revert if recommendation ID is zero", async function () {
      await expect(
        priceManager.connect(propertyManager).acceptRecommendation(0)
      ).to.be.revertedWithCustomError(priceManager, "InvalidRecommendationId");
    });

    it("Should revert if recommendation already accepted", async function () {
      await priceManager.connect(propertyManager).acceptRecommendation(1);
      await expect(
        priceManager.connect(propertyManager).acceptRecommendation(1)
      ).to.be.revertedWithCustomError(priceManager, "RecommendationAlreadyProcessed");
    });

    it("Should revert if recommendation already rejected", async function () {
      await priceManager.connect(propertyManager).rejectRecommendation(1);
      await expect(
        priceManager.connect(propertyManager).acceptRecommendation(1)
      ).to.be.revertedWithCustomError(priceManager, "RecommendationAlreadyProcessed");
    });
  });

  describe("Reject Recommendation", function () {
    const recommendedPrice = ethers.parseUnits("2100", 6);
    const confidence = 85;
    const reasoning = "Market analysis shows positive trends.";

    beforeEach(async function () {
      await priceManager.connect(propertyManager).submitRecommendation(recommendedPrice, confidence, reasoning);
    });

    it("Should allow property manager to reject recommendation", async function () {
      await expect(priceManager.connect(propertyManager).rejectRecommendation(1))
        .to.emit(priceManager, "RecommendationRejected")
        .withArgs(1, propertyManager.address);
    });

    it("Should NOT update current rental price when rejected", async function () {
      await priceManager.connect(propertyManager).rejectRecommendation(1);
      expect(await priceManager.getCurrentRentalPrice()).to.equal(INITIAL_PRICE);
    });

    it("Should mark recommendation as rejected", async function () {
      await priceManager.connect(propertyManager).rejectRecommendation(1);
      const recommendation = await priceManager.getRecommendation(1);
      expect(recommendation.accepted).to.be.false;
      expect(recommendation.rejected).to.be.true;
    });

    it("Should revert if caller is not property manager", async function () {
      await expect(
        priceManager.connect(unauthorized).rejectRecommendation(1)
      ).to.be.reverted;
    });

    it("Should revert if recommendation ID is invalid", async function () {
      await expect(
        priceManager.connect(propertyManager).rejectRecommendation(999)
      ).to.be.revertedWithCustomError(priceManager, "InvalidRecommendationId");
    });

    it("Should revert if recommendation already accepted", async function () {
      await priceManager.connect(propertyManager).acceptRecommendation(1);
      await expect(
        priceManager.connect(propertyManager).rejectRecommendation(1)
      ).to.be.revertedWithCustomError(priceManager, "RecommendationAlreadyProcessed");
    });

    it("Should revert if recommendation already rejected", async function () {
      await priceManager.connect(propertyManager).rejectRecommendation(1);
      await expect(
        priceManager.connect(propertyManager).rejectRecommendation(1)
      ).to.be.revertedWithCustomError(priceManager, "RecommendationAlreadyProcessed");
    });
  });

  describe("View Functions", function () {
    const price1 = ethers.parseUnits("2100", 6);
    const price2 = ethers.parseUnits("2200", 6);
    const price3 = ethers.parseUnits("2050", 6);
    const confidence = 85;
    const reasoning = "Market analysis shows positive trends.";

    beforeEach(async function () {
      // Submit 3 recommendations
      await priceManager.connect(propertyManager).submitRecommendation(price1, confidence, reasoning);
      await priceManager.connect(propertyManager).submitRecommendation(price2, confidence, reasoning);
      await priceManager.connect(propertyManager).submitRecommendation(price3, confidence, reasoning);

      // Accept first, reject second, leave third pending
      await priceManager.connect(propertyManager).acceptRecommendation(1);
      await priceManager.connect(propertyManager).rejectRecommendation(2);
    });

    it("Should return correct recommendation by ID", async function () {
      const rec = await priceManager.getRecommendation(1);
      expect(rec.id).to.equal(1);
      expect(rec.recommendedPrice).to.equal(price1);
      expect(rec.accepted).to.be.true;
    });

    it("Should return all recommendation IDs", async function () {
      const ids = await priceManager.getRecommendationIds();
      expect(ids.length).to.equal(3);
      expect(ids[0]).to.equal(1);
      expect(ids[1]).to.equal(2);
      expect(ids[2]).to.equal(3);
    });

    it("Should return complete recommendation history", async function () {
      const history = await priceManager.getRecommendationHistory();
      expect(history.length).to.equal(3);
      expect(history[0].id).to.equal(1);
      expect(history[1].id).to.equal(2);
      expect(history[2].id).to.equal(3);
    });

    it("Should return latest recommendation", async function () {
      const latest = await priceManager.getLatestRecommendation();
      expect(latest.id).to.equal(3);
      expect(latest.recommendedPrice).to.equal(price3);
    });

    it("Should return empty struct when no recommendations exist", async function () {
      const PriceManagerFactory = await ethers.getContractFactory("PriceManager");
      const newPriceManager = await PriceManagerFactory.deploy(
        INITIAL_PRICE,
        propertyManager.address
      );

      const latest = await newPriceManager.getLatestRecommendation();
      expect(latest.id).to.equal(0);
      expect(latest.recommendedPrice).to.equal(0);
    });

    it("Should return only pending recommendations", async function () {
      const pending = await priceManager.getPendingRecommendations();
      expect(pending.length).to.equal(1);
      expect(pending[0].id).to.equal(3);
      expect(pending[0].accepted).to.be.false;
      expect(pending[0].rejected).to.be.false;
    });

    it("Should return only accepted recommendations", async function () {
      const accepted = await priceManager.getAcceptedRecommendations();
      expect(accepted.length).to.equal(1);
      expect(accepted[0].id).to.equal(1);
      expect(accepted[0].accepted).to.be.true;
    });

    it("Should return empty array when no pending recommendations", async function () {
      await priceManager.connect(propertyManager).acceptRecommendation(3);
      const pending = await priceManager.getPendingRecommendations();
      expect(pending.length).to.equal(0);
    });

    it("Should revert when getting invalid recommendation ID", async function () {
      await expect(
        priceManager.getRecommendation(999)
      ).to.be.revertedWithCustomError(priceManager, "InvalidRecommendationId");
    });
  });

  describe("Multiple Recommendations Workflow", function () {
    it("Should handle multiple recommendations correctly", async function () {
      const prices = [
        ethers.parseUnits("2100", 6),
        ethers.parseUnits("2200", 6),
        ethers.parseUnits("2150", 6),
      ];
      const reasoning = "Market analysis.";

      // Submit multiple recommendations
      for (let i = 0; i < prices.length; i++) {
        await priceManager.connect(propertyManager).submitRecommendation(prices[i], 80 + i, reasoning);
      }

      expect(await priceManager.recommendationCount()).to.equal(3);

      // Accept the second recommendation
      await priceManager.connect(propertyManager).acceptRecommendation(2);
      expect(await priceManager.getCurrentRentalPrice()).to.equal(prices[1]);

      // Verify history
      const history = await priceManager.getRecommendationHistory();
      expect(history.length).to.equal(3);
      expect(history[1].accepted).to.be.true;
    });

    it("Should track price changes through multiple acceptances", async function () {
      const price1 = ethers.parseUnits("2100", 6);
      const price2 = ethers.parseUnits("2200", 6);
      const reasoning = "Market analysis.";

      // Submit and accept first recommendation
      await priceManager.connect(propertyManager).submitRecommendation(price1, 85, reasoning);
      await priceManager.connect(propertyManager).acceptRecommendation(1);
      expect(await priceManager.getCurrentRentalPrice()).to.equal(price1);

      // Submit and accept second recommendation
      await priceManager.connect(propertyManager).submitRecommendation(price2, 90, reasoning);
      await priceManager.connect(propertyManager).acceptRecommendation(2);
      expect(await priceManager.getCurrentRentalPrice()).to.equal(price2);
    });
  });

  describe("Edge Cases", function () {
    it("Should revert for price values outside ±50% bounds", async function () {
      const largePrice = ethers.parseUnits("1000000", 6); // $1M vs $2000 initial
      const reasoning = "Luxury property pricing.";

      await expect(
        priceManager.connect(propertyManager).submitRecommendation(largePrice, 95, reasoning)
      ).to.be.revertedWithCustomError(priceManager, "PriceOutOfBounds");
    });

    it("Should accept prices within ±50% bounds", async function () {
      const withinBoundsPrice = ethers.parseUnits("2500", 6); // $2500 is within 50% of $2000
      const reasoning = "Premium property pricing.";

      await expect(
        priceManager.connect(propertyManager).submitRecommendation(withinBoundsPrice, 95, reasoning)
      ).to.not.be.reverted;
    });

    it("Should accept reasoning at max length (512 bytes)", async function () {
      const maxReasoning = "A".repeat(512);
      const price = ethers.parseUnits("2100", 6);

      await expect(
        priceManager.connect(propertyManager).submitRecommendation(price, 85, maxReasoning)
      ).to.not.be.reverted;

      const rec = await priceManager.getRecommendation(1);
      expect(rec.reasoning).to.equal(maxReasoning);
    });

    it("Should revert when reasoning exceeds max length (512 bytes)", async function () {
      const tooLongReasoning = "A".repeat(513);
      const price = ethers.parseUnits("2100", 6);

      await expect(
        priceManager.connect(propertyManager).submitRecommendation(price, 85, tooLongReasoning)
      ).to.be.revertedWithCustomError(priceManager, "ReasoningTooLong");
    });

    it("Should revert for minimum valid price (1 unit) when it violates bounds", async function () {
      const minPrice = 1;
      const reasoning = "Minimum price test.";

      await expect(
        priceManager.connect(propertyManager).submitRecommendation(minPrice, 50, reasoning)
      ).to.be.revertedWithCustomError(priceManager, "PriceOutOfBounds");
    });

    it("Should correctly handle timestamp recording", async function () {
      const price = ethers.parseUnits("2100", 6);
      const reasoning = "Test timestamp.";

      const blockBefore = await ethers.provider.getBlock("latest");
      await priceManager.connect(propertyManager).submitRecommendation(price, 85, reasoning);
      const blockAfter = await ethers.provider.getBlock("latest");

      const rec = await priceManager.getRecommendation(1);
      expect(rec.timestamp).to.be.gte(blockBefore!.timestamp);
      expect(rec.timestamp).to.be.lte(blockAfter!.timestamp);
    });
  });

  describe("Access Control", function () {
    it("Should allow owner to grant roles", async function () {
      await priceManager.connect(owner).grantRole(PROPERTY_MANAGER_ROLE, unauthorized.address);
      expect(await priceManager.hasRole(PROPERTY_MANAGER_ROLE, unauthorized.address)).to.be.true;
    });

    it("Should allow owner to revoke roles", async function () {
      await priceManager.connect(owner).revokeRole(PROPERTY_MANAGER_ROLE, propertyManager.address);
      expect(await priceManager.hasRole(PROPERTY_MANAGER_ROLE, propertyManager.address)).to.be.false;
    });

    it("Should prevent unauthorized role granting", async function () {
      await expect(
        priceManager.connect(unauthorized).grantRole(PROPERTY_MANAGER_ROLE, unauthorized.address)
      ).to.be.reverted;
    });
  });
});
