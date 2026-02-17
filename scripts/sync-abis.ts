import * as fs from 'fs';
import * as path from 'path';

const ARTIFACTS_DIR = path.join(__dirname, '../artifacts/contracts');
const DASHBOARD_ABIS_DIR = path.join(__dirname, '../dashboard/lib/abis');

const CONTRACTS_TO_SYNC = [
    'PropertyToken',
    'PriceManager',
    'YieldDistributor',
    'PropertySale',
    'PropertyToken', // check if duplicated
];

// Map contract name to artifact path (some might be in subfolders)
const CONTRACT_PATHS: Record<string, string> = {
    'PropertyToken': 'PropertyToken.sol/PropertyToken.json',
    'PriceManager': 'PriceManager.sol/PriceManager.json',
    'YieldDistributor': 'YieldDistributor.sol/YieldDistributor.json',
    'PropertySale': 'PropertySale.sol/PropertySale.json',
    // MockUSDC is likely ERC20. Or usage of OpenZeppelin ERC20?
    // We can use a standard ERC20 ABI or find where MockUSDC is.
};

async function main() {
    if (!fs.existsSync(DASHBOARD_ABIS_DIR)) {
        fs.mkdirSync(DASHBOARD_ABIS_DIR, { recursive: true });
    }

    for (const [name, artifactSubPath] of Object.entries(CONTRACT_PATHS)) {
        const artifactPath = path.join(ARTIFACTS_DIR, artifactSubPath);
        if (fs.existsSync(artifactPath)) {
            const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
            const abiPath = path.join(DASHBOARD_ABIS_DIR, `${name}.json`);
            fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
            console.log(`Synced ABI for ${name} to ${abiPath}`);
        } else {
            console.warn(`Artifact not found for ${name} at ${artifactPath}`);
        }
    }

    // Handle ERC20 separately if needed, or if it is a mock in contracts/mocks
    // Assuming basic ERC20 for now.
}

main().catch(console.error);
