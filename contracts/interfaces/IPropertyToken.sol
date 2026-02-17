// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IPropertyToken {
    function getPropertyDetails() external view returns (string memory, string memory, uint256 valuation, uint256 totalTokens);
    function isWhitelisted(address account) external view returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}
