interface ValidatorSlashingInfo {
    // Define the structure based on the actual response
    val_signing_info: {
        address: string;
        start_height: string;
        index_offset: string;
        jailed_until: string;
        tombstoned: boolean;
        missed_blocks_counter: string;
    };
}

interface LatestBlock {
    // Define the structure based on the actual response
    block: {
        header: {
            chain_id: string;
            height: string;
            time: string;
            // Add other relevant fields
        };
        // Add other relevant fields
    };
}

interface Validator {
    // Define the structure based on the actual response
    address: string;
    pub_key: {
        type: string;
        value: string;
    };
    voting_power: string;
    proposer_priority: string;
}

interface ValidatorSetResponse {
    validators: Validator[];
    pagination: {
        next_key: string | null;
        total: string;
    };
}

export async function GetValidatorSlashingInfos(apiUrl: string, consensusAddress: string): Promise<ValidatorSlashingInfo> {
    const response = await fetch(`${apiUrl}/cosmos/slashing/v1beta1/signing_infos/${consensusAddress}`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json() as Promise<ValidatorSlashingInfo>;
}

export async function GetLatestBlock(apiUrl: string): Promise<LatestBlock> {
    const response = await fetch(`${apiUrl}/cosmos/base/tendermint/v1beta1/blocks/latest`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json() as Promise<LatestBlock>;
}

export async function GetValidatorSet(apiUrl: string): Promise<ValidatorSetResponse> {
    const response = await fetch(`${apiUrl}/cosmos/base/tendermint/v1beta1/validatorsets/latest?pagination.limit=128`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json() as Promise<ValidatorSetResponse>;
}
