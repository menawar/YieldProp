// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IERC1400 Security Token Standard
 * @dev See https://github.com/ethereum/EIPs/issues/1411
 */
interface IERC1400 {
    
    // ============ Document Management ============
    
    function getDocument(bytes32 name) external view returns (string memory, bytes32);
    function setDocument(bytes32 name, string calldata uri, bytes32 documentHash) external;
    
    // ============ Token Information ============
    
    function balanceOfByPartition(bytes32 partition, address tokenHolder) external view returns (uint256);
    function partitionsOf(address tokenHolder) external view returns (bytes32[] memory);
    
    // ============ Transfers ============
    
    function transferWithData(address to, uint256 value, bytes calldata data) external;
    function transferFromWithData(address from, address to, uint256 value, bytes calldata data) external;
    
    // ============ Partition Token Transfers ============
    
    function transferByPartition(
        bytes32 partition,
        address to,
        uint256 value,
        bytes calldata data
    ) external returns (bytes32);
    
    function operatorTransferByPartition(
        bytes32 partition,
        address from,
        address to,
        uint256 value,
        bytes calldata data,
        bytes calldata operatorData
    ) external returns (bytes32);
    
    // ============ Controller Operation ============
    
    function isControllable() external view returns (bool);
    function controllerTransfer(
        address from,
        address to,
        uint256 value,
        bytes calldata data,
        bytes calldata operatorData
    ) external;
    function controllerRedeem(
        address tokenHolder,
        uint256 value,
        bytes calldata data,
        bytes calldata operatorData
    ) external;
    
    // ============ Operator Management ============
    
    function authorizeOperator(address operator) external;
    function revokeOperator(address operator) external;
    function authorizeOperatorByPartition(bytes32 partition, address operator) external;
    function revokeOperatorByPartition(bytes32 partition, address operator) external;
    
    // ============ Operator Information ============
    
    function isOperator(address operator, address tokenHolder) external view returns (bool);
    function isOperatorForPartition(
        bytes32 partition,
        address operator,
        address tokenHolder
    ) external view returns (bool);
    
    // ============ Token Issuance ============
    
    function isIssuable() external view returns (bool);
    function issue(address tokenHolder, uint256 value, bytes calldata data) external;
    function issueByPartition(
        bytes32 partition,
        address tokenHolder,
        uint256 value,
        bytes calldata data
    ) external;
    
    // ============ Token Redemption ============
    
    function redeem(uint256 value, bytes calldata data) external;
    function redeemFrom(address tokenHolder, uint256 value, bytes calldata data) external;
    function redeemByPartition(bytes32 partition, uint256 value, bytes calldata data) external;
    function operatorRedeemByPartition(
        bytes32 partition,
        address tokenHolder,
        uint256 value,
        bytes calldata operatorData
    ) external;
    
    // ============ Transfer Validity ============
    
    function canTransfer(
        address to,
        uint256 value,
        bytes calldata data
    ) external view returns (bytes1, bytes32);
    
    function canTransferFrom(
        address from,
        address to,
        uint256 value,
        bytes calldata data
    ) external view returns (bytes1, bytes32);
    
    function canTransferByPartition(
        address from,
        address to,
        bytes32 partition,
        uint256 value,
        bytes calldata data
    ) external view returns (bytes1, bytes32, bytes32);
    
    // ============ Events ============
    
    // Controller Events
    event ControllerTransfer(
        address controller,
        address indexed from,
        address indexed to,
        uint256 value,
        bytes data,
        bytes operatorData
    );
    
    event ControllerRedemption(
        address controller,
        address indexed tokenHolder,
        uint256 value,
        bytes data,
        bytes operatorData
    );
    
    // Document Events
    event Document(bytes32 indexed name, string uri, bytes32 documentHash);
    
    // Transfer Events
    event TransferByPartition(
        bytes32 indexed fromPartition,
        address operator,
        address indexed from,
        address indexed to,
        uint256 value,
        bytes data,
        bytes operatorData
    );
    
    event ChangedPartition(
        bytes32 indexed fromPartition,
        bytes32 indexed toPartition,
        uint256 value
    );
    
    // Operator Events
    event AuthorizedOperator(address indexed operator, address indexed tokenHolder);
    event RevokedOperator(address indexed operator, address indexed tokenHolder);
    event AuthorizedOperatorByPartition(
        bytes32 indexed partition,
        address indexed operator,
        address indexed tokenHolder
    );
    event RevokedOperatorByPartition(
        bytes32 indexed partition,
        address indexed operator,
        address indexed tokenHolder
    );
    
    // Issuance / Redemption Events
    event Issued(address indexed operator, address indexed to, uint256 value, bytes data);
    event Redeemed(address indexed operator, address indexed from, uint256 value, bytes data);
    event IssuedByPartition(
        bytes32 indexed partition,
        address indexed operator,
        address indexed to,
        uint256 value,
        bytes data,
        bytes operatorData
    );
    event RedeemedByPartition(
        bytes32 indexed partition,
        address indexed operator,
        address indexed from,
        uint256 value,
        bytes operatorData
    );
}
