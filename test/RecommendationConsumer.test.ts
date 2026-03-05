import { expect } from "chai";
import { ethers } from "hardhat";

describe("RecommendationConsumer", function () {
  it("accepts a forwarded report and submits it to PriceManager", async function () {
    const [owner, propertyManager, forwarder] = await ethers.getSigners();

    const PriceManagerFactory = await ethers.getContractFactory("PriceManager");
    const priceManager = await PriceManagerFactory.deploy(
      ethers.parseUnits("2000", 6),
      propertyManager.address
    );

    const RecommendationConsumerFactory = await ethers.getContractFactory("RecommendationConsumer");
    const consumer = await RecommendationConsumerFactory.deploy(
      forwarder.address,
      await priceManager.getAddress()
    );

    const role = await priceManager.PROPERTY_MANAGER_ROLE();
    await priceManager.connect(owner).grantRole(role, await consumer.getAddress());

    const price = ethers.parseUnits("2200", 6);
    const confidence = 83n;
    const reasoning = "CRE report: median comps increased while occupancy remains stable.";
    const report = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "uint256", "string"],
      [price, confidence, reasoning]
    );

    await expect(consumer.connect(forwarder).onReport("0x", report))
      .to.emit(consumer, "RecommendationReceived")
      .withArgs(price, confidence, reasoning);

    expect(await priceManager.recommendationCount()).to.equal(1n);
    const rec = await priceManager.getRecommendation(1);
    expect(rec.recommendedPrice).to.equal(price);
    expect(rec.confidenceScore).to.equal(confidence);
    expect(rec.reasoning).to.equal(reasoning);
  });

  it("rejects reports from unauthorized senders when forwarder is set", async function () {
    const [owner, propertyManager, forwarder, attacker] = await ethers.getSigners();

    const PriceManagerFactory = await ethers.getContractFactory("PriceManager");
    const priceManager = await PriceManagerFactory.deploy(
      ethers.parseUnits("2000", 6),
      propertyManager.address
    );

    const RecommendationConsumerFactory = await ethers.getContractFactory("RecommendationConsumer");
    const consumer = await RecommendationConsumerFactory.deploy(
      forwarder.address,
      await priceManager.getAddress()
    );

    const role = await priceManager.PROPERTY_MANAGER_ROLE();
    await priceManager.connect(owner).grantRole(role, await consumer.getAddress());

    const report = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "uint256", "string"],
      [ethers.parseUnits("2100", 6), 80n, "test reasoning payload"]
    );

    await expect(consumer.connect(attacker).onReport("0x", report))
      .to.be.revertedWithCustomError(consumer, "InvalidForwarder")
      .withArgs(attacker.address, forwarder.address);
  });
});
