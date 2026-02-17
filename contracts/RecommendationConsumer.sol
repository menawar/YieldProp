// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IReceiver.sol";
import "./PriceManager.sol";

/**
 * @title RecommendationConsumer
 * @dev CRE workflow consumer contract that receives AI-generated rental price
 *      recommendations and submits them to the PriceManager contract.
 *
 * This contract follows the Chainlink CRE onchain-write pattern:
 *   CRE Workflow → KeystoneForwarder → RecommendationConsumer → PriceManager
 *
 * The CRE workflow:
 *   1. Fetches market data from RentCast API
 *   2. Generates AI pricing via OpenAI
 *   3. Creates a signed report with (price, confidence, reasoning)
 *   4. Submits the report via EVMClient.writeReport()
 *   5. KeystoneForwarder validates and calls onReport() on this contract
 *   6. This contract decodes the report and calls PriceManager.submitRecommendation()
 *
 * @notice For simulation, deploy with MockForwarder (0x15fC6ae953E024d975e77382eEeC56A9101f9F88 on Sepolia).
 *         For production, use KeystoneForwarder (0xF8344CFd5c43616a4366C34E3EEE75af79a74482 on Sepolia).
 * @dev This contract must be granted PROPERTY_MANAGER_ROLE on the PriceManager.
 */
contract RecommendationConsumer is IReceiver, Ownable {
    PriceManager public immutable priceManager;
    address public forwarderAddress;

    event RecommendationReceived(
        uint256 price,
        uint256 confidence,
        string reasoning
    );
    event ForwarderUpdated(address indexed oldForwarder, address indexed newForwarder);

    error InvalidForwarder(address sender, address expected);
    error InvalidPriceManagerAddress();

    /**
     * @param _forwarderAddress Chainlink KeystoneForwarder or MockForwarder address
     * @param _priceManager Address of the PriceManager contract to submit recommendations to
     */
    constructor(
        address _forwarderAddress,
        address _priceManager
    ) Ownable(msg.sender) {
        if (_priceManager == address(0)) revert InvalidPriceManagerAddress();
        forwarderAddress = _forwarderAddress;
        priceManager = PriceManager(_priceManager);
    }

    /// @inheritdoc IReceiver
    function onReport(
        bytes calldata,
        bytes calldata report
    ) external override {
        if (forwarderAddress != address(0) && msg.sender != forwarderAddress) {
            revert InvalidForwarder(msg.sender, forwarderAddress);
        }

        (uint256 price, uint256 confidence, string memory reasoning) = abi.decode(
            report,
            (uint256, uint256, string)
        );

        emit RecommendationReceived(price, confidence, reasoning);

        priceManager.submitRecommendation(price, confidence, reasoning);
    }

    /// @notice Update the forwarder address (for transitioning simulation → production)
    function setForwarderAddress(address _forwarder) external onlyOwner {
        address old = forwarderAddress;
        forwarderAddress = _forwarder;
        emit ForwarderUpdated(old, _forwarder);
    }

    /// @inheritdoc IERC165
    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return
            interfaceId == type(IReceiver).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }
}
