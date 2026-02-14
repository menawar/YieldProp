import { expect } from "chai";
import { ethers } from "hardhat";
import { PropertyToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("PropertyToken - Full ERC-1400 Implementation", function () {
  let propertyToken: PropertyToken;
  let owner: SignerWithAddress;
  let propertyManager: SignerWithAddress;
  let controller: SignerWithAddress;
  let investor1: SignerWithAddress;
  let investor2: SignerWithAddress;
  let operator: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  const PROPERTY_ADDRESS = "123 Main St, San Francisco, CA";
  const PROPERTY_TYPE = "Single Family";
  const PROPERTY_VALUATION = ethers.parseEther("500000");
  const TOTAL_TOKENS = 100n;
  const TOKEN_DECIMALS = 18n;
  
  const DEFAULT_PARTITION = ethers.ZeroHash;
  const PARTITION_A = ethers.id("partitionA");
  const PARTITION_B = ethers.id("partitionB");

  beforeEach(async function () {
    [owner, propertyManager, controller, investor1, investor2, operator, unauthorized] = 
      await ethers.getSigners();

    const PropertyTokenFactory = await ethers.getContractFactory("PropertyToken");
    propertyToken = await PropertyTokenFactory.deploy(
      PROPERTY_ADDRESS,
      PROPERTY_TYPE,
      PROPERTY_VALUATION,
      propertyManager.address,
      "",
      ""
    );
    await propertyToken.waitForDeployment();
  });

  describe("1. Deployment & Initialization", function () {
    it("Should set correct property metadata", async function () {
      const metadata = await propertyToken.getPropertyDetails();
      expect(metadata.propertyAddress).to.equal(PROPERTY_ADDRESS);
      expect(metadata.propertyType).to.equal(PROPERTY_TYPE);
      expect(metadata.valuation).to.equal(PROPERTY_VALUATION);
      expect(metadata.totalTokens).to.equal(TOTAL_TOKENS);
    });

    it("Should mint total supply to deployer in default partition", async function () {
      const expectedSupply = TOTAL_TOKENS * (10n ** TOKEN_DECIMALS);
      expect(await propertyToken.totalSupply()).to.equal(expectedSupply);
      expect(await propertyToken.balanceOf(owner.address)).to.equal(expectedSupply);
      expect(await propertyToken.balanceOfByPartition(DEFAULT_PARTITION, owner.address))
        .to.equal(expectedSupply);
    });

    it("Should automatically whitelist deployer and property manager", async function () {
      expect(await propertyToken.isWhitelisted(owner.address)).to.be.true;
      expect(await propertyToken.isWhitelisted(propertyManager.address)).to.be.true;
    });

    it("Should grant correct roles", async function () {
      const PROPERTY_MANAGER_ROLE = await propertyToken.PROPERTY_MANAGER_ROLE();
      const CONTROLLER_ROLE = await propertyToken.CONTROLLER_ROLE();
      const ISSUER_ROLE = await propertyToken.ISSUER_ROLE();
      
      expect(await propertyToken.hasRole(PROPERTY_MANAGER_ROLE, propertyManager.address)).to.be.true;
      expect(await propertyToken.hasRole(CONTROLLER_ROLE, propertyManager.address)).to.be.true;
      expect(await propertyToken.hasRole(ISSUER_ROLE, owner.address)).to.be.true;
    });

    it("Should be controllable and issuable by default", async function () {
      expect(await propertyToken.isControllable()).to.be.true;
      expect(await propertyToken.isIssuable()).to.be.true;
    });
  });

  describe("2. Partition Management", function () {
    beforeEach(async function () {
      await propertyToken.connect(propertyManager).addToWhitelist(investor1.address);
    });

    it("Should track partitions correctly", async function () {
      const partitions = await propertyToken.partitionsOf(owner.address);
      expect(partitions.length).to.equal(1);
      expect(partitions[0]).to.equal(DEFAULT_PARTITION);
    });

    it("Should transfer tokens by partition", async function () {
      const transferAmount = ethers.parseEther("10");
      
      await expect(
        propertyToken.connect(owner).transferByPartition(
          DEFAULT_PARTITION,
          investor1.address,
          transferAmount,
          "0x"
        )
      ).to.emit(propertyToken, "TransferByPartition")
        .withArgs(DEFAULT_PARTITION, owner.address, owner.address, investor1.address, transferAmount, "0x", "0x");

      expect(await propertyToken.balanceOfByPartition(DEFAULT_PARTITION, investor1.address))
        .to.equal(transferAmount);
    });

    it("Should handle multiple partitions per holder", async function () {
      const ISSUER_ROLE = await propertyToken.ISSUER_ROLE();
      await propertyToken.grantRole(ISSUER_ROLE, owner.address);
      
      // First transfer some tokens to investor1 in default partition
      const transferAmount = ethers.parseEther("10");
      await propertyToken.connect(owner).transfer(investor1.address, transferAmount);
      
      // Then issue tokens to a different partition
      const issueAmount = ethers.parseEther("50");
      await propertyToken.connect(owner).issueByPartition(
        PARTITION_A,
        investor1.address,
        issueAmount,
        "0x"
      );

      const partitions = await propertyToken.partitionsOf(investor1.address);
      expect(partitions.length).to.equal(2);
      expect(partitions).to.include(DEFAULT_PARTITION);
      expect(partitions).to.include(PARTITION_A);
    });

    it("Should revert on insufficient partition balance", async function () {
      const transferAmount = ethers.parseEther("10");
      
      await expect(
        propertyToken.connect(owner).transferByPartition(
          PARTITION_A,
          investor1.address,
          transferAmount,
          "0x"
        )
      ).to.be.revertedWithCustomError(propertyToken, "InsufficientPartitionBalance");
    });
  });

  describe("3. Operator Management", function () {
    beforeEach(async function () {
      await propertyToken.connect(propertyManager).addToWhitelist(investor1.address);
      await propertyToken.connect(propertyManager).addToWhitelist(investor2.address);
      await propertyToken.connect(propertyManager).addToWhitelist(operator.address);
      
      const transferAmount = ethers.parseEther("50");
      await propertyToken.connect(owner).transfer(investor1.address, transferAmount);
    });

    it("Should authorize and revoke global operator", async function () {
      await expect(propertyToken.connect(investor1).authorizeOperator(operator.address))
        .to.emit(propertyToken, "AuthorizedOperator")
        .withArgs(operator.address, investor1.address);

      expect(await propertyToken.isOperator(operator.address, investor1.address)).to.be.true;

      await expect(propertyToken.connect(investor1).revokeOperator(operator.address))
        .to.emit(propertyToken, "RevokedOperator")
        .withArgs(operator.address, investor1.address);

      expect(await propertyToken.isOperator(operator.address, investor1.address)).to.be.false;
    });

    it("Should authorize operator by partition", async function () {
      await expect(
        propertyToken.connect(investor1).authorizeOperatorByPartition(DEFAULT_PARTITION, operator.address)
      ).to.emit(propertyToken, "AuthorizedOperatorByPartition")
        .withArgs(DEFAULT_PARTITION, operator.address, investor1.address);

      expect(await propertyToken.isOperatorForPartition(DEFAULT_PARTITION, operator.address, investor1.address))
        .to.be.true;
    });

    it("Should allow operator to transfer by partition", async function () {
      await propertyToken.connect(investor1).authorizeOperatorByPartition(DEFAULT_PARTITION, operator.address);
      
      const transferAmount = ethers.parseEther("10");
      await expect(
        propertyToken.connect(operator).operatorTransferByPartition(
          DEFAULT_PARTITION,
          investor1.address,
          investor2.address,
          transferAmount,
          "0x",
          "0x"
        )
      ).to.emit(propertyToken, "TransferByPartition");

      expect(await propertyToken.balanceOf(investor2.address)).to.equal(transferAmount);
    });

    it("Should revert when unauthorized operator tries to transfer", async function () {
      const transferAmount = ethers.parseEther("10");
      
      await expect(
        propertyToken.connect(unauthorized).operatorTransferByPartition(
          DEFAULT_PARTITION,
          investor1.address,
          investor2.address,
          transferAmount,
          "0x",
          "0x"
        )
      ).to.be.revertedWithCustomError(propertyToken, "NotAuthorized");
    });
  });

  describe("4. Controller Operations", function () {
    beforeEach(async function () {
      await propertyToken.connect(propertyManager).addToWhitelist(investor1.address);
      await propertyToken.connect(propertyManager).addToWhitelist(investor2.address);
      
      const transferAmount = ethers.parseEther("50");
      await propertyToken.connect(owner).transfer(investor1.address, transferAmount);
    });

    it("Should allow controller to force transfer", async function () {
      const transferAmount = ethers.parseEther("10");
      
      await expect(
        propertyToken.connect(propertyManager).controllerTransfer(
          investor1.address,
          investor2.address,
          transferAmount,
          "0x",
          "0x"
        )
      ).to.emit(propertyToken, "ControllerTransfer")
        .withArgs(propertyManager.address, investor1.address, investor2.address, transferAmount, "0x", "0x");

      expect(await propertyToken.balanceOf(investor2.address)).to.equal(transferAmount);
    });

    it("Should allow controller to force redeem", async function () {
      const redeemAmount = ethers.parseEther("10");
      const initialBalance = await propertyToken.balanceOf(investor1.address);
      
      await expect(
        propertyToken.connect(propertyManager).controllerRedeem(
          investor1.address,
          redeemAmount,
          "0x",
          "0x"
        )
      ).to.emit(propertyToken, "ControllerRedemption")
        .withArgs(propertyManager.address, investor1.address, redeemAmount, "0x", "0x");

      expect(await propertyToken.balanceOf(investor1.address)).to.equal(initialBalance - redeemAmount);
    });

    it("Should allow renouncing control", async function () {
      await expect(propertyToken.connect(owner).renounceControl())
        .to.emit(propertyToken, "ControllableSet")
        .withArgs(false);

      expect(await propertyToken.isControllable()).to.be.false;
    });

    it("Should revert controller operations after renouncing control", async function () {
      await propertyToken.connect(owner).renounceControl();
      
      await expect(
        propertyToken.connect(propertyManager).controllerTransfer(
          investor1.address,
          investor2.address,
          ethers.parseEther("10"),
          "0x",
          "0x"
        )
      ).to.be.revertedWithCustomError(propertyToken, "NotAuthorized");
    });
  });

  describe("5. Token Issuance", function () {
    beforeEach(async function () {
      await propertyToken.connect(propertyManager).addToWhitelist(investor1.address);
    });

    it("Should allow issuer to mint new tokens", async function () {
      const issueAmount = ethers.parseEther("50");
      
      await expect(
        propertyToken.connect(owner).issue(investor1.address, issueAmount, "0x")
      ).to.emit(propertyToken, "Issued")
        .withArgs(owner.address, investor1.address, issueAmount, "0x");

      expect(await propertyToken.balanceOf(investor1.address)).to.equal(issueAmount);
    });

    it("Should allow issuing to specific partition", async function () {
      const issueAmount = ethers.parseEther("50");
      
      await expect(
        propertyToken.connect(owner).issueByPartition(
          PARTITION_A,
          investor1.address,
          issueAmount,
          "0x"
        )
      ).to.emit(propertyToken, "IssuedByPartition")
        .withArgs(PARTITION_A, owner.address, investor1.address, issueAmount, "0x", "0x");

      expect(await propertyToken.balanceOfByPartition(PARTITION_A, investor1.address))
        .to.equal(issueAmount);
    });

    it("Should revert issuance to non-whitelisted address", async function () {
      await expect(
        propertyToken.connect(owner).issue(unauthorized.address, ethers.parseEther("10"), "0x")
      ).to.be.revertedWithCustomError(propertyToken, "NotWhitelisted");
    });

    it("Should allow renouncing issuance", async function () {
      await expect(propertyToken.connect(owner).renounceIssuance())
        .to.emit(propertyToken, "IssuableSet")
        .withArgs(false);

      expect(await propertyToken.isIssuable()).to.be.false;
    });

    it("Should revert issuance after renouncing", async function () {
      await propertyToken.connect(owner).renounceIssuance();
      
      await expect(
        propertyToken.connect(owner).issue(investor1.address, ethers.parseEther("10"), "0x")
      ).to.be.revertedWithCustomError(propertyToken, "NotIssuable");
    });
  });

  describe("6. Token Redemption", function () {
    beforeEach(async function () {
      await propertyToken.connect(propertyManager).addToWhitelist(investor1.address);
      await propertyToken.connect(owner).transfer(investor1.address, ethers.parseEther("50"));
    });

    it("Should allow token holder to redeem tokens", async function () {
      const redeemAmount = ethers.parseEther("10");
      const initialBalance = await propertyToken.balanceOf(investor1.address);
      
      await expect(
        propertyToken.connect(investor1).redeem(redeemAmount, "0x")
      ).to.emit(propertyToken, "Redeemed")
        .withArgs(investor1.address, investor1.address, redeemAmount, "0x");

      expect(await propertyToken.balanceOf(investor1.address)).to.equal(initialBalance - redeemAmount);
    });

    it("Should allow redeeming by partition", async function () {
      const redeemAmount = ethers.parseEther("10");
      
      await expect(
        propertyToken.connect(investor1).redeemByPartition(DEFAULT_PARTITION, redeemAmount, "0x")
      ).to.emit(propertyToken, "RedeemedByPartition")
        .withArgs(DEFAULT_PARTITION, investor1.address, investor1.address, redeemAmount, "0x");
    });

    it("Should allow operator to redeem on behalf of holder", async function () {
      await propertyToken.connect(investor1).authorizeOperator(operator.address);
      await propertyToken.connect(propertyManager).addToWhitelist(operator.address);
      
      const redeemAmount = ethers.parseEther("10");
      
      await expect(
        propertyToken.connect(operator).redeemFrom(investor1.address, redeemAmount, "0x")
      ).to.emit(propertyToken, "Redeemed")
        .withArgs(operator.address, investor1.address, redeemAmount, "0x");
    });
  });

  describe("7. Document Management", function () {
    it("Should allow property manager to set documents", async function () {
      const docName = ethers.id("offering-memorandum");
      const docUri = "ipfs://QmXyz123...";
      const docHash = ethers.id("document-hash");
      
      await expect(
        propertyToken.connect(propertyManager).setDocument(docName, docUri, docHash)
      ).to.emit(propertyToken, "Document")
        .withArgs(docName, docUri, docHash);

      const [uri, hash] = await propertyToken.getDocument(docName);
      expect(uri).to.equal(docUri);
      expect(hash).to.equal(docHash);
    });

    it("Should revert when non-manager tries to set document", async function () {
      const docName = ethers.id("offering-memorandum");
      
      await expect(
        propertyToken.connect(unauthorized).setDocument(docName, "ipfs://test", ethers.ZeroHash)
      ).to.be.revertedWithCustomError(propertyToken, "AccessControlUnauthorizedAccount");
    });
  });

  describe("8. Transfer Validity Checks", function () {
    beforeEach(async function () {
      await propertyToken.connect(propertyManager).addToWhitelist(investor1.address);
    });

    it("Should return success status for valid transfer", async function () {
      const [statusCode] = await propertyToken.canTransfer(
        investor1.address,
        ethers.parseEther("10"),
        "0x"
      );
      expect(statusCode).to.equal("0x51"); // STATUS_TRANSFER_SUCCESS
    });

    it("Should return invalid receiver for non-whitelisted address", async function () {
      const [statusCode] = await propertyToken.canTransfer(
        unauthorized.address,
        ethers.parseEther("10"),
        "0x"
      );
      expect(statusCode).to.equal("0x57"); // STATUS_INVALID_RECEIVER
    });

    it("Should return insufficient balance status", async function () {
      const [statusCode] = await propertyToken.connect(investor1).canTransfer(
        owner.address,
        ethers.parseEther("1000"),
        "0x"
      );
      expect(statusCode).to.equal("0x52"); // STATUS_INSUFFICIENT_BALANCE
    });

    it("Should check partition transfer validity", async function () {
      const [statusCode, , partition] = await propertyToken.canTransferByPartition(
        owner.address,
        investor1.address,
        DEFAULT_PARTITION,
        ethers.parseEther("10"),
        "0x"
      );
      expect(statusCode).to.equal("0x51");
      expect(partition).to.equal(DEFAULT_PARTITION);
    });
  });

  describe("9. Whitelist Management", function () {
    it("Should allow property manager to add to whitelist", async function () {
      await expect(propertyToken.connect(propertyManager).addToWhitelist(investor1.address))
        .to.emit(propertyToken, "WhitelistUpdated")
        .withArgs(investor1.address, true);

      expect(await propertyToken.isWhitelisted(investor1.address)).to.be.true;
    });

    it("Should allow batch whitelisting", async function () {
      const addresses = [investor1.address, investor2.address];
      
      await propertyToken.connect(propertyManager).batchAddToWhitelist(addresses);

      expect(await propertyToken.isWhitelisted(investor1.address)).to.be.true;
      expect(await propertyToken.isWhitelisted(investor2.address)).to.be.true;
    });

    it("Should enforce transfer restrictions", async function () {
      await expect(
        propertyToken.connect(owner).transfer(unauthorized.address, ethers.parseEther("10"))
      ).to.be.revertedWithCustomError(propertyToken, "TransferRestricted");
    });
  });

  describe("10. Property Information", function () {
    it("Should calculate ownership percentage correctly", async function () {
      await propertyToken.connect(propertyManager).addToWhitelist(investor1.address);
      await propertyToken.connect(owner).transfer(investor1.address, ethers.parseEther("25"));

      expect(await propertyToken.getOwnershipPercentage(investor1.address)).to.equal(2500); // 25%
      expect(await propertyToken.getOwnershipPercentage(owner.address)).to.equal(7500); // 75%
    });

    it("Should maintain immutable property metadata", async function () {
      const metadataBefore = await propertyToken.getPropertyDetails();
      
      await propertyToken.connect(propertyManager).addToWhitelist(investor1.address);
      await propertyToken.connect(owner).transfer(investor1.address, ethers.parseEther("50"));
      
      const metadataAfter = await propertyToken.getPropertyDetails();
      expect(metadataAfter.propertyAddress).to.equal(metadataBefore.propertyAddress);
      expect(metadataAfter.valuation).to.equal(metadataBefore.valuation);
    });
  });

  describe("10b. Transfer from Non-Default Partition", function () {
    beforeEach(async function () {
      await propertyToken.connect(propertyManager).addToWhitelist(investor1.address);
      await propertyToken.connect(propertyManager).addToWhitelist(investor2.address);
    });

    it("Should transfer via transfer() when sender has tokens only in non-default partition", async function () {
      await propertyToken.connect(owner).issueByPartition(
        PARTITION_A,
        investor1.address,
        ethers.parseEther("20"),
        "0x"
      );
      expect(await propertyToken.balanceOfByPartition(PARTITION_A, investor1.address)).to.equal(ethers.parseEther("20"));
      expect(await propertyToken.balanceOfByPartition(DEFAULT_PARTITION, investor1.address)).to.equal(0n);

      await propertyToken.connect(investor1).transfer(investor2.address, ethers.parseEther("10"));
      expect(await propertyToken.balanceOf(investor1.address)).to.equal(ethers.parseEther("10"));
      expect(await propertyToken.balanceOf(investor2.address)).to.equal(ethers.parseEther("10"));
      expect(await propertyToken.balanceOfByPartition(DEFAULT_PARTITION, investor2.address)).to.equal(ethers.parseEther("10"));
    });

    it("Should transfer across multiple partitions when single partition has insufficient balance", async function () {
      await propertyToken.connect(owner).issueByPartition(PARTITION_A, investor1.address, ethers.parseEther("5"), "0x");
      await propertyToken.connect(owner).issueByPartition(PARTITION_B, investor1.address, ethers.parseEther("10"), "0x");
      await propertyToken.connect(investor1).transfer(investor2.address, ethers.parseEther("12"));
      expect(await propertyToken.balanceOf(investor1.address)).to.equal(ethers.parseEther("3"));
      expect(await propertyToken.balanceOf(investor2.address)).to.equal(ethers.parseEther("12"));
    });
  });

  describe("11. ERC-20 Compatibility", function () {
    beforeEach(async function () {
      await propertyToken.connect(propertyManager).addToWhitelist(investor1.address);
      await propertyToken.connect(propertyManager).addToWhitelist(investor2.address);
    });

    it("Should support standard ERC-20 transfer", async function () {
      const transferAmount = ethers.parseEther("10");
      
      await expect(propertyToken.connect(owner).transfer(investor1.address, transferAmount))
        .to.emit(propertyToken, "Transfer")
        .withArgs(owner.address, investor1.address, transferAmount);
    });

    it("Should support approve and transferFrom", async function () {
      const amount = ethers.parseEther("10");
      
      await propertyToken.connect(owner).approve(investor1.address, amount);
      expect(await propertyToken.allowance(owner.address, investor1.address)).to.equal(amount);
      
      await propertyToken.connect(investor1).transferFrom(owner.address, investor2.address, amount);
      expect(await propertyToken.balanceOf(investor2.address)).to.equal(amount);
    });

    it("Should return correct token metadata", async function () {
      expect(await propertyToken.name()).to.equal("Property Token");
      expect(await propertyToken.symbol()).to.equal("PROP");
      expect(await propertyToken.decimals()).to.equal(18);
    });
  });
});
