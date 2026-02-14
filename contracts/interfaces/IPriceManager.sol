// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IPriceManager
 * @dev Minimal interface for rental price validation
 */
interface IPriceManager {
    function getCurrentRentalPrice() external view returns (uint256);
}
