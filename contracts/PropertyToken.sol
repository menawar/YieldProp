// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IERC1400.sol";

/**
 * @title PropertyToken
 * @dev Full ERC-1400 compliant security token for tokenized real estate
 * 
 * This contract implements the complete ERC-1400 security token standard with:
 * - ERC20 compatibility for ecosystem interoperability
 * - Partition-based token management (partially fungible tokens)
 * - Transfer restrictions via whitelist for compliance
 * - Operator management for delegated transfers
 * - Controller operations for regulatory compliance
 * - Document management for legal documentation
 * - Issuance and redemption capabilities
 * - Immutable property metadata
 * 
 * @custom:security-contact See SECURITY.md
 * @notice TRUST MODEL: PROPERTY_MANAGER_ROLE controls whitelist; CONTROLLER_ROLE can force
 *         transfer/redeem; ISSUER_ROLE can mint. DEFAULT_ADMIN_ROLE uses 2-step transfer with
 *         configurable delay (see AccessControlDefaultAdminRules). Production: use multisig.
 */
contract PropertyToken is ERC20, AccessControlDefaultAdminRules, ReentrancyGuard, IERC1400 {
    
    // ============ Roles ============
    
    bytes32 public constant PROPERTY_MANAGER_ROLE = keccak256("PROPERTY_MANAGER_ROLE");
    bytes32 public constant CONTROLLER_ROLE = keccak256("CONTROLLER_ROLE");
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    
    // ============ Structs ============
    
    struct PropertyMetadata {
        string propertyAddress;
        string propertyType;
        uint256 valuation;
        uint256 totalTokens;
        uint256 deploymentTimestamp;
    }
    
    struct Doc {
        string uri;
        bytes32 documentHash;
    }
    
    // ============ State Variables ============
    
    PropertyMetadata public propertyMetadata;
    
    // Partition management
    bytes32 public constant DEFAULT_PARTITION = bytes32(0);
    mapping(address => bytes32[]) private _partitionsOf;
    mapping(address => mapping(bytes32 => uint256)) private _balanceOfByPartition;
    mapping(address => mapping(bytes32 => uint256)) private _indexOfPartitionsOf;
    
    // Whitelist for transfer restrictions
    mapping(address => bool) private _whitelist;
    
    // Operator management
    mapping(address => mapping(address => bool)) private _authorizedOperator;
    mapping(bytes32 => mapping(address => mapping(address => bool))) private _authorizedOperatorByPartition;
    
    // Document management
    mapping(bytes32 => Doc) private _documents;
    
    // Controller and issuance flags
    bool private _isControllable;
    bool private _isIssuable;
    
    // Fixed supply: 100 tokens = 100% ownership
    uint256 private constant TOTAL_TOKENS = 100;
    uint256 private constant TOKEN_DECIMALS = 18;
    
    // ERC-1066 Status Codes
    bytes1 private constant STATUS_TRANSFER_FAILURE = 0x50;
    bytes1 private constant STATUS_TRANSFER_SUCCESS = 0x51;
    bytes1 private constant STATUS_INSUFFICIENT_BALANCE = 0x52;
    bytes1 private constant STATUS_INVALID_SENDER = 0x56;
    bytes1 private constant STATUS_INVALID_RECEIVER = 0x57;
    
    // ============ Events ============
    
    event WhitelistUpdated(address indexed account, bool status);
    event PropertyMetadataSet(string propertyAddress, string propertyType, uint256 valuation);
    event ControllableSet(bool isControllable);
    event IssuableSet(bool isIssuable);
    
    // ============ Errors ============
    
    error NotWhitelisted(address account);
    error InvalidAddress();
    error InvalidValuation();
    error TransferRestricted(address from, address to);
    error InsufficientPartitionBalance(bytes32 partition, uint256 requested, uint256 available);
    error NotAuthorized();
    error NotIssuable();
    error InvalidPartition();
    
    // ============ Constructor ============
    
    /**
     * @param _tokenName Token name (e.g. "YieldProp 123 Main St"). Empty = "Property Token"
     * @param _tokenSymbol Token symbol (e.g. "YF-123"). Empty = "PROP"
     */
    constructor(
        string memory _propertyAddress,
        string memory _propertyType,
        uint256 _valuation,
        address _propertyManager,
        string memory _tokenName,
        string memory _tokenSymbol
    ) 
        AccessControlDefaultAdminRules(2 days, msg.sender)
        ERC20(
            bytes(_tokenName).length > 0 ? _tokenName : "Property Token",
            bytes(_tokenSymbol).length > 0 ? _tokenSymbol : "PROP"
        )
    {
        if (_propertyManager == address(0)) revert InvalidAddress();
        if (_valuation == 0) revert InvalidValuation();
        
        // Set up roles (DEFAULT_ADMIN_ROLE set by AccessControlDefaultAdminRules)
        _grantRole(PROPERTY_MANAGER_ROLE, _propertyManager);
        _grantRole(CONTROLLER_ROLE, _propertyManager);
        _grantRole(ISSUER_ROLE, msg.sender);
        
        // Initialize property metadata
        propertyMetadata = PropertyMetadata({
            propertyAddress: _propertyAddress,
            propertyType: _propertyType,
            valuation: _valuation,
            totalTokens: TOTAL_TOKENS,
            deploymentTimestamp: block.timestamp
        });
        
        // Set initial flags
        _isControllable = true;
        _isIssuable = true;
        
        // Mint total supply to deployer in default partition
        uint256 totalSupply = TOTAL_TOKENS * 10**TOKEN_DECIMALS;
        _mint(msg.sender, totalSupply);
        _addTokenToPartition(msg.sender, DEFAULT_PARTITION, totalSupply);
        
        // Automatically whitelist the deployer and property manager
        _whitelist[msg.sender] = true;
        _whitelist[_propertyManager] = true;
        
        emit PropertyMetadataSet(_propertyAddress, _propertyType, _valuation);
        emit WhitelistUpdated(msg.sender, true);
        emit WhitelistUpdated(_propertyManager, true);
        emit ControllableSet(true);
        emit IssuableSet(true);
    }
    
    // ============ ERC20 Override Functions ============
    
    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        if (!_whitelist[msg.sender] || !_whitelist[to]) {
            revert TransferRestricted(msg.sender, to);
        }
        _moveFromPartitionsToReceiver(msg.sender, to, amount);
        return super.transfer(to, amount);
    }
    
    function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
        if (!_whitelist[from] || !_whitelist[to]) {
            revert TransferRestricted(from, to);
        }
        _moveFromPartitionsToReceiver(from, to, amount);
        return super.transferFrom(from, to, amount);
    }
    
    // ============ Document Management ============
    
    function getDocument(bytes32 name) external view override returns (string memory, bytes32) {
        return (_documents[name].uri, _documents[name].documentHash);
    }
    
    function setDocument(bytes32 name, string calldata uri, bytes32 documentHash) 
        external 
        override 
        onlyRole(PROPERTY_MANAGER_ROLE) 
    {
        _documents[name] = Doc(uri, documentHash);
        emit Document(name, uri, documentHash);
    }
    
    // ============ Token Information ============
    
    function balanceOfByPartition(bytes32 partition, address tokenHolder) 
        external 
        view 
        override 
        returns (uint256) 
    {
        return _balanceOfByPartition[tokenHolder][partition];
    }
    
    function partitionsOf(address tokenHolder) external view override returns (bytes32[] memory) {
        return _partitionsOf[tokenHolder];
    }
    
    // ============ Transfers ============
    
    function transferWithData(address to, uint256 value, bytes calldata data) 
        external 
        override 
    {
        _transferWithData(msg.sender, to, value, data);
    }
    
    function transferFromWithData(address from, address to, uint256 value, bytes calldata data) 
        external 
        override 
    {
        _spendAllowance(from, msg.sender, value);
        _transferWithData(from, to, value, data);
    }
    
    function _transferWithData(address from, address to, uint256 value, bytes memory /*data*/) 
        internal 
    {
        if (!_whitelist[from] || !_whitelist[to]) {
            revert TransferRestricted(from, to);
        }
        _moveFromPartitionsToReceiver(from, to, value);
        _transfer(from, to, value);
    }
    
    // ============ Partition Token Transfers ============
    
    function transferByPartition(
        bytes32 partition,
        address to,
        uint256 value,
        bytes calldata data
    ) external override returns (bytes32) {
        return _transferByPartition(partition, msg.sender, msg.sender, to, value, data, "");
    }
    
    function operatorTransferByPartition(
        bytes32 partition,
        address from,
        address to,
        uint256 value,
        bytes calldata data,
        bytes calldata operatorData
    ) external override returns (bytes32) {
        if (!_isOperatorForPartition(partition, msg.sender, from) && 
            !(_isControllable && hasRole(CONTROLLER_ROLE, msg.sender))) {
            revert NotAuthorized();
        }
        
        return _transferByPartition(partition, msg.sender, from, to, value, data, operatorData);
    }
    
    function _transferByPartition(
        bytes32 fromPartition,
        address operator,
        address from,
        address to,
        uint256 value,
        bytes memory data,
        bytes memory operatorData
    ) internal returns (bytes32) {
        if (!_whitelist[from] || !_whitelist[to]) {
            revert TransferRestricted(from, to);
        }
        
        if (_balanceOfByPartition[from][fromPartition] < value) {
            revert InsufficientPartitionBalance(
                fromPartition,
                value,
                _balanceOfByPartition[from][fromPartition]
            );
        }
        
        _removeTokenFromPartition(from, fromPartition, value);
        _addTokenToPartition(to, fromPartition, value);
        _transfer(from, to, value);
        
        emit TransferByPartition(fromPartition, operator, from, to, value, data, operatorData);
        
        return fromPartition;
    }
    
    // ============ Controller Operation ============
    
    function isControllable() external view override returns (bool) {
        return _isControllable;
    }
    
    function controllerTransfer(
        address from,
        address to,
        uint256 value,
        bytes calldata data,
        bytes calldata operatorData
    ) external override onlyRole(CONTROLLER_ROLE) {
        if (!_isControllable) revert NotAuthorized();
        
        _removeTokenFromPartition(from, DEFAULT_PARTITION, value);
        _addTokenToPartition(to, DEFAULT_PARTITION, value);
        _transfer(from, to, value);
        
        emit ControllerTransfer(msg.sender, from, to, value, data, operatorData);
    }
    
    function controllerRedeem(
        address tokenHolder,
        uint256 value,
        bytes calldata data,
        bytes calldata operatorData
    ) external override onlyRole(CONTROLLER_ROLE) {
        if (!_isControllable) revert NotAuthorized();
        
        _removeTokenFromPartition(tokenHolder, DEFAULT_PARTITION, value);
        _burn(tokenHolder, value);
        
        emit ControllerRedemption(msg.sender, tokenHolder, value, data, operatorData);
    }
    
    function renounceControl() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _isControllable = false;
        emit ControllableSet(false);
    }
    
    // ============ Operator Management ============
    
    function authorizeOperator(address operator) external override {
        _authorizedOperator[msg.sender][operator] = true;
        emit AuthorizedOperator(operator, msg.sender);
    }
    
    function revokeOperator(address operator) external override {
        _authorizedOperator[msg.sender][operator] = false;
        emit RevokedOperator(operator, msg.sender);
    }
    
    function authorizeOperatorByPartition(bytes32 partition, address operator) external override {
        _authorizedOperatorByPartition[partition][msg.sender][operator] = true;
        emit AuthorizedOperatorByPartition(partition, operator, msg.sender);
    }
    
    function revokeOperatorByPartition(bytes32 partition, address operator) external override {
        _authorizedOperatorByPartition[partition][msg.sender][operator] = false;
        emit RevokedOperatorByPartition(partition, operator, msg.sender);
    }
    
    // ============ Operator Information ============
    
    function isOperator(address operator, address tokenHolder) external view override returns (bool) {
        return _isOperator(operator, tokenHolder);
    }
    
    function isOperatorForPartition(
        bytes32 partition,
        address operator,
        address tokenHolder
    ) external view override returns (bool) {
        return _isOperatorForPartition(partition, operator, tokenHolder);
    }
    
    function _isOperator(address operator, address tokenHolder) internal view returns (bool) {
        return operator == tokenHolder || _authorizedOperator[tokenHolder][operator];
    }
    
    function _isOperatorForPartition(
        bytes32 partition,
        address operator,
        address tokenHolder
    ) internal view returns (bool) {
        return _isOperator(operator, tokenHolder) || 
               _authorizedOperatorByPartition[partition][tokenHolder][operator];
    }
    
    // ============ Token Issuance ============
    
    function isIssuable() external view override returns (bool) {
        return _isIssuable;
    }
    
    function issue(address tokenHolder, uint256 value, bytes calldata data) 
        external 
        override 
        onlyRole(ISSUER_ROLE) 
    {
        if (!_isIssuable) revert NotIssuable();
        if (!_whitelist[tokenHolder]) revert NotWhitelisted(tokenHolder);
        
        _mint(tokenHolder, value);
        _addTokenToPartition(tokenHolder, DEFAULT_PARTITION, value);
        
        emit Issued(msg.sender, tokenHolder, value, data);
    }
    
    function issueByPartition(
        bytes32 partition,
        address tokenHolder,
        uint256 value,
        bytes calldata data
    ) external override onlyRole(ISSUER_ROLE) {
        if (!_isIssuable) revert NotIssuable();
        if (!_whitelist[tokenHolder]) revert NotWhitelisted(tokenHolder);
        
        _mint(tokenHolder, value);
        _addTokenToPartition(tokenHolder, partition, value);
        
        emit IssuedByPartition(partition, msg.sender, tokenHolder, value, data, "");
    }
    
    function renounceIssuance() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _isIssuable = false;
        emit IssuableSet(false);
    }
    
    // ============ Token Redemption ============
    
    function redeem(uint256 value, bytes calldata data) external override {
        _removeAmountFromPartitions(msg.sender, value);
        _burn(msg.sender, value);
        emit Redeemed(msg.sender, msg.sender, value, data);
    }
    
    function redeemFrom(address tokenHolder, uint256 value, bytes calldata data) 
        external 
        override 
    {
        if (!_isOperator(msg.sender, tokenHolder)) revert NotAuthorized();
        
        _removeAmountFromPartitions(tokenHolder, value);
        _burn(tokenHolder, value);
        emit Redeemed(msg.sender, tokenHolder, value, data);
    }
    
    function redeemByPartition(bytes32 partition, uint256 value, bytes calldata data) 
        external 
        override 
    {
        _removeTokenFromPartition(msg.sender, partition, value);
        _burn(msg.sender, value);
        emit RedeemedByPartition(partition, msg.sender, msg.sender, value, data);
    }
    
    function operatorRedeemByPartition(
        bytes32 partition,
        address tokenHolder,
        uint256 value,
        bytes calldata operatorData
    ) external override {
        if (!_isOperatorForPartition(partition, msg.sender, tokenHolder)) {
            revert NotAuthorized();
        }
        
        _removeTokenFromPartition(tokenHolder, partition, value);
        _burn(tokenHolder, value);
        emit RedeemedByPartition(partition, msg.sender, tokenHolder, value, operatorData);
    }
    
    // ============ Transfer Validity ============
    
    function canTransfer(address to, uint256 value, bytes calldata /*data*/) 
        external 
        view 
        override 
        returns (bytes1, bytes32) 
    {
        return _canTransfer(msg.sender, to, value);
    }
    
    function canTransferFrom(address from, address to, uint256 value, bytes calldata /*data*/) 
        external 
        view 
        override 
        returns (bytes1, bytes32) 
    {
        return _canTransfer(from, to, value);
    }
    
    function canTransferByPartition(
        address from,
        address to,
        bytes32 partition,
        uint256 value,
        bytes calldata /*data*/
    ) external view override returns (bytes1, bytes32, bytes32) {
        (bytes1 statusCode, bytes32 reason) = _canTransfer(from, to, value);
        
        if (statusCode == STATUS_TRANSFER_SUCCESS) {
            if (_balanceOfByPartition[from][partition] < value) {
                return (STATUS_INSUFFICIENT_BALANCE, bytes32(0), partition);
            }
        }
        
        return (statusCode, reason, partition);
    }
    
    function _canTransfer(address from, address to, uint256 value) 
        internal 
        view 
        returns (bytes1, bytes32) 
    {
        if (!_whitelist[from]) {
            return (STATUS_INVALID_SENDER, bytes32(0));
        }
        if (!_whitelist[to]) {
            return (STATUS_INVALID_RECEIVER, bytes32(0));
        }
        if (balanceOf(from) < value) {
            return (STATUS_INSUFFICIENT_BALANCE, bytes32(0));
        }
        return (STATUS_TRANSFER_SUCCESS, bytes32(0));
    }
    
    // ============ Partition Management Internal Functions ============
    
    /**
     * @dev Remove tokens from sender's partitions (any partition with balance) and add to receiver's default partition
     * @notice Supports transfers when sender holds tokens in non-default partitions (e.g. from issueByPartition)
     */
    function _moveFromPartitionsToReceiver(address from, address to, uint256 amount) internal {
        if (balanceOf(from) < amount) revert InsufficientPartitionBalance(DEFAULT_PARTITION, amount, balanceOf(from));
        
        uint256 remaining = amount;
        bytes32[] storage partitions = _partitionsOf[from];
        uint256 i = 0;
        
        while (i < partitions.length && remaining > 0) {
            bytes32 partition = partitions[i];
            uint256 partBalance = _balanceOfByPartition[from][partition];
            if (partBalance > 0) {
                uint256 take = partBalance < remaining ? partBalance : remaining;
                _removeTokenFromPartition(from, partition, take);
                remaining -= take;
                // When partition is emptied, swap-and-pop replaces index i; do not increment
            } else {
                i++;
            }
        }
        
        _addTokenToPartition(to, DEFAULT_PARTITION, amount);
    }
    
    /**
     * @dev Remove amount from tokenHolder's partitions (any partition with balance). Used for burns.
     */
    function _removeAmountFromPartitions(address tokenHolder, uint256 amount) internal {
        uint256 remaining = amount;
        bytes32[] storage partitions = _partitionsOf[tokenHolder];
        uint256 i = 0;
        
        while (i < partitions.length && remaining > 0) {
            bytes32 partition = partitions[i];
            uint256 partBalance = _balanceOfByPartition[tokenHolder][partition];
            if (partBalance > 0) {
                uint256 take = partBalance < remaining ? partBalance : remaining;
                _removeTokenFromPartition(tokenHolder, partition, take);
                remaining -= take;
            } else {
                i++;
            }
        }
    }
    
    function _addTokenToPartition(address tokenHolder, bytes32 partition, uint256 value) internal {
        if (_balanceOfByPartition[tokenHolder][partition] == 0) {
            _partitionsOf[tokenHolder].push(partition);
            _indexOfPartitionsOf[tokenHolder][partition] = _partitionsOf[tokenHolder].length;
        }
        _balanceOfByPartition[tokenHolder][partition] += value;
    }
    
    function _removeTokenFromPartition(address tokenHolder, bytes32 partition, uint256 value) internal {
        if (_balanceOfByPartition[tokenHolder][partition] < value) {
            revert InsufficientPartitionBalance(
                partition,
                value,
                _balanceOfByPartition[tokenHolder][partition]
            );
        }
        
        _balanceOfByPartition[tokenHolder][partition] -= value;
        
        if (_balanceOfByPartition[tokenHolder][partition] == 0) {
            uint256 index = _indexOfPartitionsOf[tokenHolder][partition];
            if (index > 0) {
                uint256 lastIndex = _partitionsOf[tokenHolder].length;
                bytes32 lastPartition = _partitionsOf[tokenHolder][lastIndex - 1];
                
                _partitionsOf[tokenHolder][index - 1] = lastPartition;
                _indexOfPartitionsOf[tokenHolder][lastPartition] = index;
                
                _partitionsOf[tokenHolder].pop();
                delete _indexOfPartitionsOf[tokenHolder][partition];
            }
        }
    }
    
    // ============ Property Information Functions ============
    
    function getPropertyDetails() 
        external 
        view 
        returns (
            string memory propertyAddress,
            string memory propertyType,
            uint256 valuation,
            uint256 totalTokens
        ) 
    {
        return (
            propertyMetadata.propertyAddress,
            propertyMetadata.propertyType,
            propertyMetadata.valuation,
            propertyMetadata.totalTokens
        );
    }
    
    function getOwnershipPercentage(address holder) external view returns (uint256) {
        uint256 balance = balanceOf(holder);
        if (balance == 0) return 0;
        return (balance * 10000) / totalSupply();
    }
    
    // ============ Whitelist Management Functions ============
    
    function isWhitelisted(address account) external view returns (bool) {
        return _whitelist[account];
    }
    
    function addToWhitelist(address account) external onlyRole(PROPERTY_MANAGER_ROLE) {
        if (account == address(0)) revert InvalidAddress();
        _whitelist[account] = true;
        emit WhitelistUpdated(account, true);
    }
    
    function removeFromWhitelist(address account) external onlyRole(PROPERTY_MANAGER_ROLE) {
        _whitelist[account] = false;
        emit WhitelistUpdated(account, false);
    }
    
    function batchAddToWhitelist(address[] calldata accounts) 
        external 
        onlyRole(PROPERTY_MANAGER_ROLE) 
    {
        for (uint256 i = 0; i < accounts.length; i++) {
            if (accounts[i] != address(0)) {
                _whitelist[accounts[i]] = true;
                emit WhitelistUpdated(accounts[i], true);
            }
        }
    }
    
    // ============ View Functions ============
    
    function getDeploymentTimestamp() external view returns (uint256) {
        return propertyMetadata.deploymentTimestamp;
    }
    
    function decimals() public pure override returns (uint8) {
        return uint8(TOKEN_DECIMALS);
    }
}
